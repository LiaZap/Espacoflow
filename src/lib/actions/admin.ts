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
import { lerCadastros, cadastroSheetConfigurado } from "@/lib/google/cadastro-sheet";

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

/**
 * Importa os clientes da planilha de respostas do formulário (mesma do cadastro) como
 * RECORRENTES (status "cliente" + aceite), casando/criando por telefone no formato do
 * WhatsApp. Idempotente (re-rodar atualiza). Apenas owner/super_admin.
 */
export async function importarCadastrosFormulario(): Promise<{
  erro?: string;
  ok?: boolean;
  total?: number;
  criados?: number;
  atualizados?: number;
}> {
  const sessao = await exigirSessao();
  if (!temPapel(sessao.role, "owner")) {
    return { erro: "Apenas o proprietário (owner) pode importar cadastros." };
  }
  if (!cadastroSheetConfigurado()) {
    return { erro: "Planilha de cadastro não configurada (defina GOOGLE_CADASTRO_SHEET_ID)." };
  }

  const cadastros = await lerCadastros();
  if (cadastros.length === 0) {
    return { erro: "Não consegui ler a planilha — confira a conexão do Google (reconectar) e o acesso à planilha." };
  }

  let criados = 0;
  let atualizados = 0;
  for (const c of cadastros) {
    // Inclui soft-deletado na busca para respeitar o UNIQUE(telefone).
    const [existente] = await db.select().from(clientes).where(eq(clientes.telefone, c.telefone));
    if (existente) {
      await db
        .update(clientes)
        .set({
          status_lead: "cliente",
          is_deleted: false,
          deleted_at: null,
          ...(c.aceitou && !existente.aceitou_politica_em ? { aceitou_politica_em: new Date() } : {}),
          ...(!existente.profissao && c.profissao ? { profissao: c.profissao } : {}),
          ...(!existente.email && c.email ? { email: c.email } : {}),
          ...(!existente.documento && c.documento ? { documento: c.documento } : {}),
          ...((!existente.nome || existente.nome === existente.telefone) && c.nome ? { nome: c.nome } : {}),
          updated_at: new Date(),
          modified_by: sessao.userId,
        })
        .where(eq(clientes.id, existente.id));
      atualizados++;
    } else {
      await db.insert(clientes).values({
        nome: c.nome,
        telefone: c.telefone,
        email: c.email,
        documento: c.documento,
        profissao: c.profissao,
        status_lead: "cliente",
        origem: "importado",
        aceitou_politica_em: c.aceitou ? new Date() : null,
        modified_by: sessao.userId,
      });
      criados++;
    }
  }

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "criar",
    entidade: "clientes",
    detalhes: `Importou cadastros do formulário: ${criados} novo(s), ${atualizados} atualizado(s) (total ${cadastros.length}).`,
  });
  revalidatePath("/clientes");
  return { ok: true, total: cadastros.length, criados, atualizados };
}
