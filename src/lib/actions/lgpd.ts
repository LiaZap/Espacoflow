"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { lgpdConfig, lgpdSolicitacoes } from "@/lib/db/schema/lgpd";
import { solicitacaoSchema } from "@/lib/validators/lgpd";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, primeiroErro } from "./_helpers";

export async function obterConfigLgpd() {
  await exigirPermissao("configuracoes", "ler");
  const [c] = await db.select().from(lgpdConfig).where(eq(lgpdConfig.is_deleted, false)).limit(1);
  return c ?? null;
}

export async function listarSolicitacoes() {
  await exigirPermissao("configuracoes", "ler");
  return db
    .select()
    .from(lgpdSolicitacoes)
    .where(eq(lgpdSolicitacoes.is_deleted, false))
    .orderBy(desc(lgpdSolicitacoes.created_at));
}

export type FormState = { erro?: string; ok?: boolean };

export async function criarSolicitacao(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  const parsed = solicitacaoSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  const prazo = new Date(Date.now() + 15 * 86_400_000); // prazo legal de 15 dias
  const [nova] = await db
    .insert(lgpdSolicitacoes)
    .values({
      nome_solicitante: d.nome_solicitante,
      email_solicitante: d.email_solicitante || null,
      telefone_solicitante: d.telefone_solicitante || null,
      tipo: d.tipo,
      prioridade: d.prioridade,
      descricao: d.descricao || null,
      status: "aberto",
      prazo_em: prazo,
      modified_by: sessao.userId,
    })
    .returning();

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "criar",
    entidade: "lgpd_solicitacoes",
    registroId: nova.id,
    detalhes: `DSAR (${d.tipo}) de ${d.nome_solicitante}`,
  });
  revalidatePath("/configuracoes/lgpd");
  return { ok: true };
}

export async function atualizarStatusSolicitacao(
  id: string,
  status: "aberto" | "em_andamento" | "resolvido" | "rejeitado"
): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  await db
    .update(lgpdSolicitacoes)
    .set({
      status,
      resolvido_em: status === "resolvido" || status === "rejeitado" ? new Date() : null,
      updated_at: new Date(),
      modified_by: sessao.userId,
    })
    .where(and(eq(lgpdSolicitacoes.id, id), eq(lgpdSolicitacoes.is_deleted, false)));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "lgpd_solicitacoes",
    registroId: id,
    detalhes: `DSAR → ${status}`,
  });
  revalidatePath("/configuracoes/lgpd");
  return {};
}
