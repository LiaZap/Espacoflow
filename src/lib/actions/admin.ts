"use server";

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { clientes, clientesAnotacoes, clientesConsentimentos } from "@/lib/db/schema/clientes";
import { clientesPacotes, clientesPacotesMovimentos } from "@/lib/db/schema/pacotes";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import {
  whatsappConversas,
  whatsappMensagens,
  whatsappConversasEstado,
} from "@/lib/db/schema/whatsapp";
import { exigirSessao } from "@/lib/auth";
import { temPapel } from "@/lib/auth/rbac";
import { registrarAuditoria } from "@/lib/audit/logger";
import { removerEventoReserva } from "@/lib/google/calendar";

function soft() {
  return { is_deleted: true, deleted_at: new Date(), updated_at: new Date() };
}

/**
 * Limpa (SOFT DELETE) os contatos que entraram pelo WhatsApp e TUDO ligado a eles
 * (conversas, mensagens, reservas, pagamentos, pacotes, anotações, consentimentos).
 * Uso de UAT para recomeçar os testes do zero. Apenas owner/super_admin. Reversível
 * no banco (nada é apagado fisicamente). Remove também os eventos no Google Calendar.
 */
export async function limparDadosTesteWhatsapp(): Promise<{ erro?: string; ok?: boolean; total?: number }> {
  const sessao = await exigirSessao();
  if (!temPapel(sessao.role, "owner")) {
    return { erro: "Apenas o proprietário (owner) pode limpar dados de teste." };
  }

  const alvos = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.origem, "whatsapp"), eq(clientes.is_deleted, false)));
  const ids = alvos.map((c) => c.id);
  if (ids.length === 0) return { ok: true, total: 0 };

  // Reservas com evento no Google → remover depois (best-effort, fora da transação).
  const comEvento = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(
      and(inArray(reservas.cliente_id, ids), eq(reservas.is_deleted, false), isNotNull(reservas.google_event_id))
    );

  await db.transaction(async (tx) => {
    const convs = await tx
      .select({ id: whatsappConversas.id })
      .from(whatsappConversas)
      .where(inArray(whatsappConversas.cliente_id, ids));
    const convIds = convs.map((c) => c.id);

    const pacs = await tx
      .select({ id: clientesPacotes.id })
      .from(clientesPacotes)
      .where(inArray(clientesPacotes.cliente_id, ids));
    const pacIds = pacs.map((p) => p.id);

    if (convIds.length) {
      await tx.update(whatsappMensagens).set(soft()).where(inArray(whatsappMensagens.conversa_id, convIds));
      await tx
        .update(whatsappConversasEstado)
        .set(soft())
        .where(inArray(whatsappConversasEstado.conversa_id, convIds));
    }
    if (pacIds.length) {
      await tx
        .update(clientesPacotesMovimentos)
        .set(soft())
        .where(inArray(clientesPacotesMovimentos.cliente_pacote_id, pacIds));
    }
    await tx.update(whatsappConversas).set(soft()).where(inArray(whatsappConversas.cliente_id, ids));
    await tx.update(pagamentos).set(soft()).where(inArray(pagamentos.cliente_id, ids));
    await tx.update(reservas).set(soft()).where(inArray(reservas.cliente_id, ids));
    await tx.update(clientesPacotes).set(soft()).where(inArray(clientesPacotes.cliente_id, ids));
    await tx.update(clientesAnotacoes).set(soft()).where(inArray(clientesAnotacoes.cliente_id, ids));
    await tx.update(clientesConsentimentos).set(soft()).where(inArray(clientesConsentimentos.cliente_id, ids));
    await tx.update(clientes).set(soft()).where(inArray(clientes.id, ids));
  });

  for (const r of comEvento) await removerEventoReserva(r.id).catch(() => undefined);

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "excluir",
    entidade: "clientes",
    severidade: "warn",
    detalhes: `Limpou ${ids.length} contato(s) de teste (WhatsApp) e dados ligados.`,
  });
  revalidatePath("/conversas");
  revalidatePath("/clientes");
  revalidatePath("/reservas");
  revalidatePath("/pagamentos");
  return { ok: true, total: ids.length };
}
