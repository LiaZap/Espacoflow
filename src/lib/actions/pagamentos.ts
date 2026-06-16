"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { reservas } from "@/lib/db/schema/reservas";
import { clientes } from "@/lib/db/schema/clientes";
import { validarPagamentoSchema } from "@/lib/validators/pagamentos";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, primeiroErro } from "./_helpers";

/** Lista pagamentos com o nome do cliente. */
export async function listarPagamentos() {
  await exigirPermissao("pagamentos", "ler");
  return db
    .select({
      id: pagamentos.id,
      cliente_nome: clientes.nome,
      valor: pagamentos.valor,
      status: pagamentos.status,
      reserva_id: pagamentos.reserva_id,
      cliente_pacote_id: pagamentos.cliente_pacote_id,
      comprovante_url: pagamentos.comprovante_url,
      created_at: pagamentos.created_at,
    })
    .from(pagamentos)
    .innerJoin(clientes, eq(pagamentos.cliente_id, clientes.id))
    .where(eq(pagamentos.is_deleted, false))
    .orderBy(desc(pagamentos.created_at));
}

/**
 * Validação MANUAL do PIX (apenas humano com permissão). Confirmar dirige o
 * status da reserva vinculada para confirmada/paga.
 */
export async function validarPagamento(
  id: string,
  status: "confirmado" | "recusado",
  observacao?: string
): Promise<{ erro?: string }> {
  const parsed = validarPagamentoSchema.safeParse({ id, status, observacao });
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };

  const sessao = await exigirPermissao("pagamentos", "validar");

  await db.transaction(async (tx) => {
    const [pg] = await tx
      .select()
      .from(pagamentos)
      .where(and(eq(pagamentos.id, id), eq(pagamentos.is_deleted, false)))
      .for("update");
    if (!pg) throw new Error("Pagamento não encontrado.");

    await tx
      .update(pagamentos)
      .set({
        status,
        validado_por: sessao.userId,
        validado_em: new Date(),
        pago_em: status === "confirmado" ? new Date() : null,
        updated_at: new Date(),
        modified_by: sessao.userId,
      })
      .where(eq(pagamentos.id, id));

    if (pg.reserva_id) {
      await tx
        .update(reservas)
        .set({
          status_pagamento: status === "confirmado" ? "pago" : "pendente",
          status_reserva: status === "confirmado" ? "confirmada" : "pendente",
          updated_at: new Date(),
          modified_by: sessao.userId,
        })
        .where(eq(reservas.id, pg.reserva_id));
    }
  });

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "validar_pix",
    entidade: "pagamentos",
    registroId: id,
    severidade: "info",
    detalhes: `PIX ${status}${observacao ? ` — ${observacao}` : ""}`,
  });

  revalidatePath("/pagamentos");
  return {};
}
