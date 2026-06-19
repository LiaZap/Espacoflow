"use server";

import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hojeSaoPaulo } from "@/lib/reservas/disponibilidade";
import { pacotes, clientesPacotes, clientesPacotesMovimentos } from "@/lib/db/schema/pacotes";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { clientes } from "@/lib/db/schema/clientes";
import { pacoteSchema, venderPacoteSchema } from "@/lib/validators/pacotes";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, atualizarComLock, primeiroErro } from "./_helpers";

export async function listarPacotes() {
  await exigirPermissao("pacotes", "ler");
  return db.select().from(pacotes).where(eq(pacotes.is_deleted, false)).orderBy(asc(pacotes.preco));
}

/** Saldos ativos (com nome do cliente e do pacote) — usado no select de reserva. */
export async function listarSaldosAtivos() {
  await exigirPermissao("pacotes", "ler");
  return db
    .select({
      id: clientesPacotes.id,
      cliente_id: clientesPacotes.cliente_id,
      cliente_nome: clientes.nome,
      pacote_nome: pacotes.nome,
      horas_saldo: clientesPacotes.horas_saldo,
      valido_ate: clientesPacotes.valido_ate,
    })
    .from(clientesPacotes)
    .innerJoin(clientes, eq(clientesPacotes.cliente_id, clientes.id))
    .innerJoin(pacotes, eq(clientesPacotes.pacote_id, pacotes.id))
    .where(
      and(
        eq(clientesPacotes.is_deleted, false),
        eq(clientesPacotes.status, "ativo"),
        gt(clientesPacotes.horas_saldo, "0"),
        gte(clientesPacotes.valido_ate, hojeSaoPaulo())
      )
    )
    .orderBy(asc(clientes.nome));
}

export type FormState = { erro?: string };

export async function salvarPacote(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  const sessao = await exigirPermissao("pacotes", id ? "atualizar" : "criar");

  const parsed = pacoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  const valores = {
    nome: d.nome,
    descricao: d.descricao ?? null,
    horas_incluidas: String(d.horas_incluidas),
    validade_dias: d.validade_dias,
    preco: String(d.preco),
    tipo: d.tipo,
    ativo: formData.get("ativo") !== "false",
    modified_by: sessao.userId,
  };

  if (!id) {
    const [novo] = await db.insert(pacotes).values(valores).returning();
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "criar",
      entidade: "pacotes",
      registroId: novo.id,
      detalhes: `Criou pacote ${novo.nome}`,
    });
  } else {
    const updatedAt = new Date(String(formData.get("updated_at") ?? ""));
    const r = await atualizarComLock(pacotes, id, updatedAt, valores);
    if ("erro" in r) return { erro: r.erro };
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "atualizar",
      entidade: "pacotes",
      registroId: id,
      detalhes: `Atualizou pacote ${d.nome}`,
    });
  }

  revalidatePath("/pacotes");
  redirect("/pacotes");
}

/**
 * Vende um pacote a um cliente: cria o saldo, lança o movimento de compra e
 * gera um pagamento PIX pendente (validação humana posterior).
 */
export async function venderPacote(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("pacotes", "criar");

  const parsed = venderPacoteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const { cliente_id, pacote_id } = parsed.data;

  const [pacote] = await db
    .select()
    .from(pacotes)
    .where(and(eq(pacotes.id, pacote_id), eq(pacotes.is_deleted, false)));
  if (!pacote) return { erro: "Pacote não encontrado." };
  if (!pacote.ativo) return { erro: "Este pacote está inativo." };

  const [cli] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.id, cliente_id), eq(clientes.is_deleted, false)));
  if (!cli) return { erro: "Cliente não encontrado." };

  const horas = String(pacote.horas_incluidas);
  const validoAte = new Date(Date.now() + pacote.validade_dias * 86_400_000)
    .toISOString()
    .slice(0, 10);

  try {
    await db.transaction(async (tx) => {
      const [cp] = await tx
        .insert(clientesPacotes)
        .values({
          cliente_id,
          pacote_id,
          horas_total: horas,
          horas_consumidas: "0",
          horas_saldo: horas,
          valido_ate: validoAte,
          // Saldo só fica utilizável após a confirmação do PIX (validarPagamento).
          status: "pendente_pagamento",
          modified_by: sessao.userId,
        })
        .returning();

      await tx.insert(clientesPacotesMovimentos).values({
        cliente_pacote_id: cp.id,
        tipo: "compra",
        horas,
        saldo_apos: horas,
        motivo: `Compra do pacote ${pacote.nome}`,
        modified_by: sessao.userId,
      });

      await tx.insert(pagamentos).values({
        cliente_id,
        cliente_pacote_id: cp.id,
        valor: String(pacote.preco),
        status: "pendente",
        provedor: "pix_manual",
        modified_by: sessao.userId,
      });
    });
  } catch {
    return { erro: "Não foi possível vender o pacote. Tente novamente." };
  }

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "criar",
    entidade: "clientes_pacotes",
    detalhes: `Vendeu pacote ${pacote.nome} ao cliente ${cliente_id} (PIX pendente)`,
  });

  revalidatePath("/pacotes");
  redirect("/pagamentos");
}

/** Movimentos (extrato) de um saldo. */
export async function listarMovimentos(clientePacoteId: string) {
  await exigirPermissao("pacotes", "ler");
  return db
    .select()
    .from(clientesPacotesMovimentos)
    .where(
      and(
        eq(clientesPacotesMovimentos.cliente_pacote_id, clientePacoteId),
        eq(clientesPacotesMovimentos.is_deleted, false)
      )
    )
    .orderBy(desc(clientesPacotesMovimentos.created_at));
}
