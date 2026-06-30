"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { salas } from "@/lib/db/schema/salas";
import { salaSchema } from "@/lib/validators/salas";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, atualizarComLock, primeiroErro } from "./_helpers";

export async function listarSalas() {
  await exigirPermissao("salas", "ler");
  return db
    .select()
    .from(salas)
    .where(eq(salas.is_deleted, false))
    .orderBy(asc(salas.prioridade_alocacao), asc(salas.nome));
}

export async function obterSala(id: string) {
  await exigirPermissao("salas", "ler");
  const [sala] = await db
    .select()
    .from(salas)
    .where(and(eq(salas.id, id), eq(salas.is_deleted, false)));
  return sala ?? null;
}

export type FormState = { erro?: string };

export async function salvarSala(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const sessao = await exigirPermissao("salas", id ? "atualizar" : "criar");

  const parsed = salaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  const valores = {
    nome: d.nome,
    tipo: d.tipo,
    capacidade: d.capacidade,
    descricao: d.descricao ?? null,
    codigo_acesso: d.codigo_acesso ?? null,
    prioridade_alocacao: d.prioridade_alocacao,
    preco_hora: d.preco_hora != null ? String(d.preco_hora) : null,
    ativa: formData.get("ativa") !== "false",
    modified_by: sessao.userId,
  };

  if (!id) {
    const [nova] = await db.insert(salas).values(valores).returning();
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "criar",
      entidade: "salas",
      registroId: nova.id,
      detalhes: `Criou sala ${nova.nome}`,
      dadosNovos: nova,
    });
  } else {
    const updatedAt = new Date(String(formData.get("updated_at") ?? ""));
    const r = await atualizarComLock(salas, id, updatedAt, valores);
    if ("erro" in r) return { erro: r.erro };
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "atualizar",
      entidade: "salas",
      registroId: id,
      detalhes: `Atualizou sala ${d.nome}`,
      dadosNovos: r.registro,
    });
  }

  revalidatePath("/salas");
  redirect("/salas");
}

export async function excluirSala(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("salas", "excluir");
  const [r] = await db
    .update(salas)
    .set({ is_deleted: true, deleted_at: new Date(), updated_at: new Date(), modified_by: sessao.userId })
    .where(and(eq(salas.id, id), eq(salas.is_deleted, false)))
    .returning();
  if (r) {
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "excluir",
      entidade: "salas",
      registroId: id,
      severidade: "warn",
      detalhes: `Excluiu (soft) sala ${r.nome}`,
    });
  }
  revalidatePath("/salas");
  return {};
}
