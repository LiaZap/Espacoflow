"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";
import { clienteSchema } from "@/lib/validators/clientes";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, atualizarComLock, primeiroErro } from "./_helpers";

export async function listarClientes() {
  await exigirPermissao("clientes", "ler");
  return db
    .select()
    .from(clientes)
    .where(eq(clientes.is_deleted, false))
    .orderBy(desc(clientes.created_at));
}

export async function obterCliente(id: string) {
  await exigirPermissao("clientes", "ler");
  const [cliente] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, id), eq(clientes.is_deleted, false)));
  return cliente ?? null;
}

export type FormState = { erro?: string };

/** Cria (sem id) ou atualiza (com id + updated_at) um cliente. */
export async function salvarCliente(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const sessao = await exigirPermissao("clientes", id ? "atualizar" : "criar");

  const parsed = clienteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const dados = parsed.data;

  if (!id) {
    const [existe] = await db
      .select({ id: clientes.id })
      .from(clientes)
      .where(and(eq(clientes.telefone, dados.telefone), eq(clientes.is_deleted, false)));
    if (existe) return { erro: "Já existe um cliente com este telefone." };

    const [novo] = await db
      .insert(clientes)
      .values({ ...dados, email: dados.email ?? null, modified_by: sessao.userId })
      .returning();
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "criar",
      entidade: "clientes",
      registroId: novo.id,
      detalhes: `Criou cliente ${novo.nome}`,
      dadosNovos: novo,
    });
  } else {
    const updatedAt = new Date(String(formData.get("updated_at") ?? ""));
    const r = await atualizarComLock(clientes, id, updatedAt, {
      ...dados,
      email: dados.email ?? null,
      modified_by: sessao.userId,
    });
    if ("erro" in r) return { erro: r.erro };
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "atualizar",
      entidade: "clientes",
      registroId: id,
      detalhes: `Atualizou cliente ${dados.nome}`,
      dadosNovos: r.registro,
    });
  }

  revalidatePath("/clientes");
  redirect("/clientes");
}

/** Soft delete — nunca delete físico. */
export async function excluirCliente(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("clientes", "excluir");
  const [r] = await db
    .update(clientes)
    .set({ is_deleted: true, deleted_at: new Date(), updated_at: new Date(), modified_by: sessao.userId })
    .where(and(eq(clientes.id, id), eq(clientes.is_deleted, false)))
    .returning();
  if (r) {
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "excluir",
      entidade: "clientes",
      registroId: id,
      severidade: "warn",
      detalhes: `Excluiu (soft) cliente ${r.nome}`,
    });
  }
  revalidatePath("/clientes");
  return {};
}
