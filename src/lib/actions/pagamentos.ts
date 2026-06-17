"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { reservas } from "@/lib/db/schema/reservas";
import { clientes } from "@/lib/db/schema/clientes";
import { validarPagamentoSchema } from "@/lib/validators/pagamentos";
import { registrarAuditoria } from "@/lib/audit/logger";
import { uploadArquivo, minioConfigurado } from "@/lib/storage/minio";
import { emitirRecibo } from "@/lib/documentos/recibo";
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

  // Ao confirmar, emite o recibo em PDF (best-effort — só se o MinIO estiver configurado).
  if (status === "confirmado") {
    await emitirRecibo(id, sessao.userId).catch(() => undefined);
  }

  revalidatePath("/pagamentos");
  return {};
}

export type FormState = { erro?: string; ok?: boolean };

/** Anexa o comprovante (imagem/PDF) e marca como recebido. Sobe no MinIO. */
export async function uploadComprovante(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("pagamentos", "validar");
  if (!minioConfigurado()) return { erro: "Storage (MinIO) não configurado no servidor." };

  const id = String(formData.get("id") ?? "");
  const arquivo = formData.get("arquivo") as File | null;
  if (!id || !arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo." };
  if (arquivo.size > 5 * 1024 * 1024) return { erro: "Arquivo acima de 5 MB." };

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase();
  const url = await uploadArquivo(
    `comprovantes/${id}-${Date.now()}.${ext}`,
    buffer,
    arquivo.type || "application/octet-stream"
  );

  await db
    .update(pagamentos)
    .set({
      comprovante_url: url,
      comprovante_recebido: true,
      updated_at: new Date(),
      modified_by: sessao.userId,
    })
    .where(eq(pagamentos.id, id));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "pagamentos",
    registroId: id,
    detalhes: "Comprovante anexado",
  });
  revalidatePath("/pagamentos");
  return { ok: true };
}

/** Gera (ou re-gera) o recibo PDF de um pagamento e devolve a URL. */
export async function emitirReciboPagamento(id: string): Promise<{ erro?: string; url?: string }> {
  const sessao = await exigirPermissao("pagamentos", "validar");
  const r = await emitirRecibo(id, sessao.userId);
  if (r.url) {
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "criar",
      entidade: "documentos_versoes",
      registroId: id,
      detalhes: "Emitiu recibo (PDF)",
    });
    revalidatePath("/pagamentos");
  }
  return r;
}
