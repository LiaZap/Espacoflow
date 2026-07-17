"use server";

import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { hojeSaoPaulo } from "@/lib/reservas/disponibilidade";
import {
  pacotes,
  clientesPacotes,
  clientesPacotesMovimentos,
  clientesCreditos,
  politicaCancelamento,
} from "@/lib/db/schema/pacotes";
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
        gte(clientesPacotes.valido_ate, hojeSaoPaulo()),
        eq(clientes.presente_planilha, true) // painel só mostra clientes presentes na planilha (item 3)
      )
    )
    .orderBy(asc(clientes.nome));
}

export type FormState = { erro?: string; ok?: boolean };

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
 * Vende um pacote a um cliente: cria o saldo JÁ ATIVO (a venda pelo painel conta como
 * confirmada — a equipe é quem registra), lança o movimento de compra e grava o pagamento
 * como confirmado. O saldo fica utilizável na hora (a Hígia enxerga pacote "ativo").
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
          // Venda pelo painel = confirmada: saldo já nasce ATIVO e utilizável na hora.
          status: "ativo",
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

      // Pagamento registrado como CONFIRMADO (a equipe vendeu/recebeu pelo painel).
      await tx.insert(pagamentos).values({
        cliente_id,
        cliente_pacote_id: cp.id,
        valor: String(pacote.preco),
        status: "confirmado",
        provedor: "pix_manual",
        pago_em: new Date(),
        validado_em: new Date(),
        validado_por: sessao.userId,
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
    detalhes: `Vendeu pacote ${pacote.nome} ao cliente ${cliente_id} — saldo ATIVO`,
  });

  revalidatePath("/pacotes");
  redirect("/pacotes");
}

/**
 * Concede um CRÉDITO em REAIS a um cliente (cortesia/ajuste da equipe). Vira saldo real
 * que a Hígia reconhece e aplica automaticamente na próxima reserva. Validade = política.
 */
export async function concederCreditoManual(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("pacotes", "criar");
  const cliente_id = String(formData.get("cliente_id") ?? "");
  const valor = Number(String(formData.get("valor") ?? "").replace(",", "."));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!cliente_id) return { erro: "Selecione o cliente." };
  if (!Number.isFinite(valor) || valor <= 0) return { erro: "Informe um valor de crédito válido (R$)." };

  const [cli] = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(eq(clientes.id, cliente_id), eq(clientes.is_deleted, false)));
  if (!cli) return { erro: "Cliente não encontrado." };

  const [pol] = await db
    .select()
    .from(politicaCancelamento)
    .where(eq(politicaCancelamento.is_deleted, false))
    .orderBy(desc(politicaCancelamento.versao))
    .limit(1);
  const validadeDias = pol?.validade_credito_dias ?? 60;
  const expira = new Date(Date.now() + validadeDias * 86_400_000);
  const valor2 = Math.round(valor * 100) / 100;

  await db.insert(clientesCreditos).values({
    cliente_id,
    tipo: "ajuste",
    valor: String(valor2),
    expira_em: expira,
    motivo: motivo || "Crédito concedido pela equipe (cortesia)",
    modified_by: sessao.userId,
  });
  await registrarAuditoria({
    userId: sessao.userId,
    acao: "criar",
    entidade: "clientes_creditos",
    detalhes: `Concedeu R$ ${valor2.toFixed(2)} de crédito ao cliente ${cliente_id}${motivo ? ` — ${motivo}` : ""}`,
  });
  revalidatePath("/pacotes");
  return { ok: true };
}

/**
 * Ajuste MANUAL de saldo de horas de um pacote (equipe). Lança +/- horas com motivo — para
 * regularizar casos em que o consumo não foi descontado pela Hígia (ex.: reserva feita no
 * atendimento humano). O saldo é corrigido (piso 0), horas_consumidas acompanha, e fica um
 * movimento "ajuste" no extrato (append-only) — o histórico é preservado no banco.
 */
export async function ajustarSaldoManual(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("pacotes", "atualizar");
  const clientePacoteId = String(formData.get("cliente_pacote_id") ?? "");
  const horas = Number(String(formData.get("horas") ?? "").replace(",", "."));
  const motivo = String(formData.get("motivo") ?? "").trim();
  if (!clientePacoteId) return { erro: "Selecione o saldo a ajustar." };
  if (!Number.isFinite(horas) || horas === 0) return { erro: "Informe as horas do ajuste (ex.: -5 para descontar, 5 para devolver)." };
  if (!motivo) return { erro: "Informe o motivo do ajuste (fica registrado no extrato)." };

  try {
    await db.transaction(async (tx) => {
      const [cp] = await tx
        .select()
        .from(clientesPacotes)
        .where(and(eq(clientesPacotes.id, clientePacoteId), eq(clientesPacotes.is_deleted, false)))
        .for("update");
      if (!cp) throw new Error("nao_encontrado");
      const saldoAtual = Number(cp.horas_saldo);
      const novoSaldo = Math.max(0, Math.round((saldoAtual + horas) * 100) / 100);
      const delta = Math.round((novoSaldo - saldoAtual) * 100) / 100; // respeita o piso 0
      const consumidas = Math.max(0, Math.round((Number(cp.horas_consumidas) - delta) * 100) / 100);
      const vencido = String(cp.valido_ate) < hojeSaoPaulo();
      await tx
        .update(clientesPacotes)
        .set({
          horas_saldo: String(novoSaldo),
          horas_consumidas: String(consumidas),
          status: cp.status === "cancelado" ? "cancelado" : vencido ? "expirado" : novoSaldo <= 0 ? "esgotado" : "ativo",
          updated_at: new Date(),
          modified_by: sessao.userId,
        })
        .where(eq(clientesPacotes.id, cp.id));
      await tx.insert(clientesPacotesMovimentos).values({
        cliente_pacote_id: cp.id,
        tipo: "ajuste",
        horas: String(delta),
        saldo_apos: String(novoSaldo),
        motivo: `Ajuste manual: ${motivo}`,
        modified_by: sessao.userId,
      });
    });
  } catch {
    return { erro: "Não foi possível ajustar o saldo. Tente de novo." };
  }
  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "clientes_pacotes",
    registroId: clientePacoteId,
    detalhes: `Ajuste manual de saldo: ${horas > 0 ? "+" : ""}${horas}h — ${motivo}`,
  });
  revalidatePath("/pacotes");
  return { ok: true };
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
