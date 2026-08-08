"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";
import { reservas } from "@/lib/db/schema/reservas";
import { clientesPacotes } from "@/lib/db/schema/pacotes";
import { clienteSchema } from "@/lib/validators/clientes";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, atualizarComLock, primeiroErro } from "./_helpers";

export type ClienteComTags = typeof clientes.$inferSelect & {
  compareceu: boolean;
  comprou: boolean;
};

export async function listarClientes(): Promise<ClienteComTags[]> {
  await exigirPermissao("clientes", "ler");

  const lista = await db
    .select()
    .from(clientes)
    // Painel só lista quem está na planilha (item 3): geridos que saíram dela têm
    // presente_planilha=false e somem daqui — mas continuam no banco (histórico/relatórios).
    .where(and(eq(clientes.is_deleted, false), eq(clientes.presente_planilha, true)))
    .orderBy(desc(clientes.created_at));

  // Tags derivadas: COMPARECEU (reserva concluída) e COMPROU (pacote ou reserva paga).
  const [compareceram, pagaram, compraram] = await Promise.all([
    db
      .selectDistinct({ id: reservas.cliente_id })
      .from(reservas)
      .where(and(eq(reservas.is_deleted, false), eq(reservas.status_reserva, "concluida"))),
    db
      .selectDistinct({ id: reservas.cliente_id })
      .from(reservas)
      .where(and(eq(reservas.is_deleted, false), eq(reservas.status_pagamento, "pago"))),
    db
      .selectDistinct({ id: clientesPacotes.cliente_id })
      .from(clientesPacotes)
      .where(eq(clientesPacotes.is_deleted, false)),
  ]);

  const setCompareceu = new Set(compareceram.map((r) => r.id));
  const setComprou = new Set<string>([...pagaram.map((r) => r.id), ...compraram.map((r) => r.id)]);

  return lista.map((c) => ({
    ...c,
    compareceu: setCompareceu.has(c.id),
    comprou: setComprou.has(c.id),
  }));
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

  // Saldo compartilhado: o vínculo é de UM nível só (contato → titular). Recusa apontar para si
  // mesmo, para um cadastro inexistente/excluído ou para quem JÁ é contato de outro titular —
  // uma cadeia partiria o saldo em dois em silêncio.
  if (dados.titular_id) {
    if (dados.titular_id === id) return { erro: "O cliente não pode ser titular do próprio saldo." };
    const [t] = await db
      .select({ id: clientes.id, nome: clientes.nome, titular: clientes.titular_id })
      .from(clientes)
      .where(and(eq(clientes.id, dados.titular_id), eq(clientes.is_deleted, false)));
    if (!t) return { erro: "Titular do saldo não encontrado." };
    if (t.titular) {
      return { erro: `${t.nome} já usa o saldo de outro cliente. Escolha o titular principal do saldo.` };
    }
    // E este cliente não pode ser titular de alguém (senão viraria elo do meio da cadeia).
    if (id) {
      const [dependente] = await db
        .select({ nome: clientes.nome })
        .from(clientes)
        .where(and(eq(clientes.titular_id, id), eq(clientes.is_deleted, false)))
        .limit(1);
      if (dependente) {
        return {
          erro: `Este cliente já é titular do saldo de ${dependente.nome}. Desvincule esse contato antes de apontar um titular.`,
        };
      }
    }
  }

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
  // Não deixa excluir quem é TITULAR de saldo compartilhado: os contatos vinculados perderiam
  // o acesso ao pacote/crédito (que continuariam registrados neste cadastro).
  const vinculados = await db
    .select({ nome: clientes.nome })
    .from(clientes)
    .where(and(eq(clientes.titular_id, id), eq(clientes.is_deleted, false)))
    .limit(3);
  if (vinculados.length > 0) {
    return {
      erro: `Este cliente é titular do saldo de ${vinculados.map((v) => v.nome).join(", ")}. Desvincule esses contatos antes de excluir.`,
    };
  }
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
