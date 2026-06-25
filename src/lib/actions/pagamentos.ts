"use server";

import { and, desc, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { reservas } from "@/lib/db/schema/reservas";
import { clientes } from "@/lib/db/schema/clientes";
import { validarPagamentoSchema } from "@/lib/validators/pagamentos";
import { registrarAuditoria } from "@/lib/audit/logger";
import { uploadArquivo, minioConfigurado } from "@/lib/storage/minio";
import { emitirRecibo } from "@/lib/documentos/recibo";
import { sincronizarReserva } from "@/lib/google/calendar";
import { lerComprovante } from "@/lib/documentos/ler-comprovante";
import { pacotes, clientesPacotes, clientesPacotesMovimentos } from "@/lib/db/schema/pacotes";
import { exigirPermissao, primeiroErro } from "./_helpers";

class PagamentoError extends Error {}

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
      valor_lido: pagamentos.valor_lido,
      pagador_lido: pagamentos.pagador_lido,
      data_lida: pagamentos.data_lida,
      leitura_obs: pagamentos.leitura_obs,
      leitura_confere: pagamentos.leitura_confere,
      leitura_em: pagamentos.leitura_em,
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
  // Reserva a ser sincronizada no Google só APÓS confirmar (agenda = só confirmadas).
  let reservaParaSincronizar: string | null = null;

  try {
    await db.transaction(async (tx) => {
      const [pg] = await tx
        .select()
        .from(pagamentos)
        .where(and(eq(pagamentos.id, id), eq(pagamentos.is_deleted, false)))
        .for("update");
      if (!pg) throw new PagamentoError("Pagamento não encontrado.");
      // Guarda de status: não re-confirmar nem recusar um pagamento já decidido.
      if (pg.status === "confirmado" || pg.status === "recusado") {
        throw new PagamentoError(`Este pagamento já foi ${pg.status}. Recarregue a página.`);
      }

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

      // Pagamento de RESERVA: dirige o status da reserva.
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
        if (status === "confirmado") reservaParaSincronizar = pg.reserva_id;
      }

      // Pagamento de COMPRA DE PACOTE: confirma → ativa o saldo; recusa → cancela.
      if (pg.cliente_pacote_id) {
        const [cp] = await tx
          .select()
          .from(clientesPacotes)
          .where(eq(clientesPacotes.id, pg.cliente_pacote_id))
          .for("update");
        if (cp) {
          if (status === "confirmado") {
            // Validade do pacote conta a partir do PAGAMENTO (não da venda).
            const [pac] = await tx
              .select({ validade: pacotes.validade_dias })
              .from(pacotes)
              .where(eq(pacotes.id, cp.pacote_id));
            const dias = pac?.validade ?? 90;
            const validoAte = new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
            await tx
              .update(clientesPacotes)
              .set({
                status: "ativo",
                valido_ate: validoAte,
                updated_at: new Date(),
                modified_by: sessao.userId,
              })
              .where(eq(clientesPacotes.id, cp.id));
          } else {
            await tx
              .update(clientesPacotes)
              .set({
                status: "cancelado",
                horas_saldo: "0",
                is_deleted: true,
                deleted_at: new Date(),
                updated_at: new Date(),
                modified_by: sessao.userId,
              })
              .where(eq(clientesPacotes.id, cp.id));
            await tx.insert(clientesPacotesMovimentos).values({
              cliente_pacote_id: cp.id,
              tipo: "ajuste",
              horas: String(cp.horas_saldo),
              saldo_apos: "0",
              motivo: "Pagamento recusado — pacote cancelado",
              modified_by: sessao.userId,
            });
          }
        }
      }
    });
  } catch (e: unknown) {
    if (e instanceof PagamentoError) return { erro: e.message };
    return { erro: "Não foi possível validar o pagamento." };
  }

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
  // Reserva confirmada → agora SIM cria o evento no Google Calendar (best-effort).
  if (reservaParaSincronizar) {
    await sincronizarReserva(reservaParaSincronizar).catch(() => undefined);
  }

  revalidatePath("/pagamentos");
  revalidatePath("/reservas");
  revalidatePath("/pacotes");
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
  const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
  if (!TIPOS_OK.includes(arquivo.type)) {
    return { erro: "Tipo não suportado. Use JPG, PNG, WEBP, GIF ou PDF." };
  }

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
      // Reflete o estado "recebi, está em análise" (só sai de pendente).
      status: sql`case when ${pagamentos.status} = 'pendente' then 'em_analise' else ${pagamentos.status} end`,
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

  // Leitura automática por IA (best-effort) — assistiva, a equipe confirma.
  await gravarLeitura(id, buffer.toString("base64"), arquivo.type || "application/octet-stream", sessao.userId).catch(
    () => undefined
  );

  revalidatePath("/pagamentos");
  return { ok: true };
}

/** Lê o comprovante por IA e grava o resultado no pagamento (com flag de "confere"). */
async function gravarLeitura(
  id: string,
  base64: string,
  mediaType: string,
  userId?: string | null
): Promise<boolean> {
  const leitura = await lerComprovante(base64, mediaType);
  if (!leitura) return false;

  const [pg] = await db.select({ valor: pagamentos.valor }).from(pagamentos).where(eq(pagamentos.id, id));
  const confere =
    leitura.valor != null && pg?.valor != null && Math.abs(leitura.valor - Number(pg.valor)) < 0.01;

  const obs = [
    leitura.instituicao,
    leitura.id_transacao ? `id ${leitura.id_transacao}` : null,
    leitura.e_pix ? "Pix" : null,
    leitura.confianca ? `confiança ${leitura.confianca}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  await db
    .update(pagamentos)
    .set({
      valor_lido: leitura.valor != null ? String(leitura.valor) : null,
      pagador_lido: leitura.pagador,
      data_lida: leitura.data,
      leitura_obs: obs || null,
      leitura_confere: confere,
      leitura_em: new Date(),
      updated_at: new Date(),
      modified_by: userId ?? null,
    })
    .where(eq(pagamentos.id, id));
  return true;
}

/** (Re)lê o comprovante já anexado a um pagamento (botão "Ler comprovante"). */
export async function lerComprovantePagamento(id: string): Promise<{ erro?: string; lido?: boolean }> {
  const sessao = await exigirPermissao("pagamentos", "validar");

  const [pg] = await db
    .select({ comprovante_url: pagamentos.comprovante_url })
    .from(pagamentos)
    .where(and(eq(pagamentos.id, id), eq(pagamentos.is_deleted, false)));
  if (!pg?.comprovante_url) return { erro: "Anexe um comprovante primeiro." };

  try {
    const res = await fetch(pg.comprovante_url);
    if (!res.ok) return { erro: "Não consegui baixar o comprovante." };
    const mediaType = res.headers.get("content-type")?.split(";")[0] || "application/octet-stream";
    const base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
    const ok = await gravarLeitura(id, base64, mediaType, sessao.userId);
    if (!ok) return { erro: "Não consegui ler o comprovante (sem ANTHROPIC_API_KEY ou ilegível)." };
  } catch {
    return { erro: "Falha ao ler o comprovante." };
  }

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "pagamentos",
    registroId: id,
    detalhes: "Leu o comprovante (IA)",
  });
  revalidatePath("/pagamentos");
  return { lido: true };
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
