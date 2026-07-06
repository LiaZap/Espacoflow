import { and, asc, desc, eq, gt, gte, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientesPacotes,
  clientesPacotesMovimentos,
  pacotes,
  politicaCancelamento,
} from "@/lib/db/schema/pacotes";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { reservas } from "@/lib/db/schema/reservas";
import { hojeSaoPaulo } from "./disponibilidade";

/** Tipo da transação Drizzle (mesmo `tx` do db.transaction). */
type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Erro de saldo/pacote com mensagem amigável (volta pro cliente via tool_result). */
export class SaldoError extends Error {}

export interface PacoteAtivo {
  id: string;
  pacoteNome: string;
  horasSaldo: number;
  validoAte: string;
}

/**
 * Pacote ATIVO do cliente (status ativo, saldo > 0, dentro da validade). Se houver mais
 * de um, devolve o que vence primeiro (consome o mais perto de expirar). null se não há.
 */
export async function pacoteAtivoDoCliente(clienteId: string): Promise<PacoteAtivo | null> {
  const hoje = hojeSaoPaulo();
  const [cp] = await db
    .select({
      id: clientesPacotes.id,
      nome: pacotes.nome,
      saldo: clientesPacotes.horas_saldo,
      valido_ate: clientesPacotes.valido_ate,
    })
    .from(clientesPacotes)
    .innerJoin(pacotes, eq(clientesPacotes.pacote_id, pacotes.id))
    .where(
      and(
        eq(clientesPacotes.cliente_id, clienteId),
        eq(clientesPacotes.is_deleted, false),
        eq(clientesPacotes.status, "ativo"),
        gt(clientesPacotes.horas_saldo, "0"),
        gte(clientesPacotes.valido_ate, hoje)
      )
    )
    .orderBy(asc(clientesPacotes.valido_ate))
    .limit(1);
  if (!cp) return null;
  return { id: cp.id, pacoteNome: cp.nome, horasSaldo: Number(cp.saldo), validoAte: String(cp.valido_ate) };
}

/**
 * Debita horas de um pacote DENTRO de uma transação (lock + validações). Devolve o saldo
 * após o débito. O caller insere a reserva (com horas_debitadas/pacote_cliente_id) e o
 * movimento de débito (precisa do reserva_id). Reaproveita as mesmas regras do painel.
 */
export async function debitarPacoteEmTx(
  tx: Tx,
  params: { pacoteClienteId: string; clienteId: string; horas: number }
): Promise<{ saldoApos: number; horasConsumidas: number }> {
  const [cp] = await tx
    .select()
    .from(clientesPacotes)
    .where(and(eq(clientesPacotes.id, params.pacoteClienteId), eq(clientesPacotes.is_deleted, false)))
    .for("update");
  if (!cp) throw new SaldoError("Não encontrei esse pacote.");
  if (cp.cliente_id !== params.clienteId) throw new SaldoError("Esse pacote não é deste cliente.");
  if (cp.status !== "ativo") throw new SaldoError("O pacote ainda não está ativo.");
  if (String(cp.valido_ate) < hojeSaoPaulo()) throw new SaldoError("O pacote venceu — o saldo não pode mais ser usado.");
  const saldo = Number(cp.horas_saldo);
  if (saldo < params.horas) throw new SaldoError("Saldo de horas insuficiente nesse pacote.");

  const saldoApos = Math.round((saldo - params.horas) * 100) / 100;
  await tx
    .update(clientesPacotes)
    .set({
      horas_saldo: String(saldoApos),
      horas_consumidas: String(Math.round((Number(cp.horas_consumidas) + params.horas) * 100) / 100),
      status: saldoApos <= 0 ? "esgotado" : "ativo",
      updated_at: new Date(),
    })
    .where(eq(clientesPacotes.id, cp.id));
  return { saldoApos, horasConsumidas: params.horas };
}

const DIA_MS = 86_400_000;
function dataMaisDias(dias: number): string {
  return new Date(Date.now() + dias * DIA_MS).toISOString().slice(0, 10);
}

export interface CompraPacoteOk {
  ok: true;
  pacoteNome: string;
  preco: number;
  horas: number;
  clientePacoteId: string;
}

/**
 * COMPRA de pacote pela Hígia: resolve o pacote do catálogo (por horas 10/20/40 ou nome),
 * cria o saldo PENDENTE de pagamento e um pagamento Pix pendente. O saldo só fica ATIVO
 * quando o comprovante chega (ativarPacotePendentePorComprovante). O clienteId vem do servidor.
 */
export async function comprarPacoteAgente(
  clienteId: string,
  pacoteQuery: string
): Promise<CompraPacoteOk | { erro: string }> {
  const num = pacoteQuery.match(/\d+/)?.[0] ?? "";
  const catalogo = await db
    .select()
    .from(pacotes)
    .where(and(eq(pacotes.is_deleted, false), eq(pacotes.ativo, true), eq(pacotes.tipo, "pacote")));
  const escolhido =
    (num ? catalogo.find((p) => String(Math.round(Number(p.horas_incluidas))) === num) : undefined) ??
    (pacoteQuery.trim()
      ? catalogo.find((p) => p.nome.toLowerCase().includes(pacoteQuery.trim().toLowerCase()))
      : undefined);
  if (!escolhido) return { erro: "Não encontrei esse pacote. Os pacotes de saldo são 10h, 20h e 40h." };

  const horas = Number(escolhido.horas_incluidas);
  const validoAte = dataMaisDias(escolhido.validade_dias); // reajustado na ativação

  try {
    const r = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clienteId}))`);
      // Idempotência: já há compra PENDENTE do mesmo pacote? Reaproveita (não duplica).
      const [existente] = await tx
        .select({ id: clientesPacotes.id })
        .from(clientesPacotes)
        .where(
          and(
            eq(clientesPacotes.cliente_id, clienteId),
            eq(clientesPacotes.pacote_id, escolhido.id),
            eq(clientesPacotes.is_deleted, false),
            eq(clientesPacotes.status, "pendente_pagamento")
          )
        );
      if (existente) return existente.id;

      const [cp] = await tx
        .insert(clientesPacotes)
        .values({
          cliente_id: clienteId,
          pacote_id: escolhido.id,
          horas_total: String(horas),
          horas_consumidas: "0",
          horas_saldo: String(horas),
          valido_ate: validoAte,
          status: "pendente_pagamento",
        })
        .returning();
      await tx.insert(clientesPacotesMovimentos).values({
        cliente_pacote_id: cp.id,
        tipo: "compra",
        horas: String(horas),
        saldo_apos: String(horas),
        motivo: `Compra do pacote ${escolhido.nome} (via Hígia)`,
      });
      await tx.insert(pagamentos).values({
        cliente_id: clienteId,
        cliente_pacote_id: cp.id,
        valor: String(escolhido.preco),
        status: "pendente",
        provedor: "pix_manual",
      });
      return cp.id;
    });
    return { ok: true, pacoteNome: escolhido.nome, preco: Number(escolhido.preco), horas, clientePacoteId: r };
  } catch {
    return { erro: "Não consegui registrar a compra do pacote agora — tente de novo em instantes." };
  }
}

/**
 * Ativa um pacote PENDENTE quando o comprovante chega: confirma o pagamento do pacote e
 * marca o saldo como ATIVO (validade a partir de agora). Idempotente. Retorna se ativou.
 */
export async function ativarPacotePendentePorComprovante(
  clienteId: string
): Promise<{ ativado: boolean; pacoteNome?: string; horas?: number }> {
  return await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clienteId}))`);
    // Pagamento pendente de PACOTE (tem cliente_pacote_id; NÃO é de reserva).
    const [pg] = await tx
      .select()
      .from(pagamentos)
      .where(
        and(
          eq(pagamentos.cliente_id, clienteId),
          eq(pagamentos.is_deleted, false),
          inArray(pagamentos.status, ["pendente", "em_analise"]),
          isNotNull(pagamentos.cliente_pacote_id)
        )
      )
      .limit(1);
    if (!pg?.cliente_pacote_id) return { ativado: false };

    const [cp] = await tx
      .select()
      .from(clientesPacotes)
      .where(and(eq(clientesPacotes.id, pg.cliente_pacote_id), eq(clientesPacotes.is_deleted, false)))
      .for("update");
    if (!cp) return { ativado: false };

    const [pac] = await tx
      .select({ nome: pacotes.nome, validade: pacotes.validade_dias })
      .from(pacotes)
      .where(eq(pacotes.id, cp.pacote_id));

    await tx
      .update(pagamentos)
      .set({ status: "confirmado", pago_em: new Date(), validado_em: new Date(), updated_at: new Date() })
      .where(eq(pagamentos.id, pg.id));
    // Só ativa se ainda estava pendente (idempotência — não reativa/re-datar um já ativo).
    if (cp.status === "pendente_pagamento") {
      await tx
        .update(clientesPacotes)
        .set({ status: "ativo", valido_ate: dataMaisDias(pac?.validade ?? 90), updated_at: new Date() })
        .where(eq(clientesPacotes.id, cp.id));
    }
    return { ativado: true, pacoteNome: pac?.nome ?? "pacote", horas: Number(cp.horas_saldo) };
  });
}

/** Insere o movimento de débito (append-only) — chamado após inserir a reserva. */
export async function registrarDebitoEmTx(
  tx: Tx,
  params: { pacoteClienteId: string; reservaId: string; horas: number; saldoApos: number }
): Promise<void> {
  await tx.insert(clientesPacotesMovimentos).values({
    cliente_pacote_id: params.pacoteClienteId,
    reserva_id: params.reservaId,
    tipo: "debito",
    horas: String(params.horas),
    saldo_apos: String(params.saldoApos),
    motivo: `Reserva ${params.reservaId} (via Hígia)`,
  });
}

/**
 * Credita de volta as horas de um pacote ao CANCELAR, se a reserva foi paga por pacote e
 * está dentro do prazo da política. Mesma regra do cancelamento manual. Devolve as horas
 * creditadas (0 se nada a creditar). Tudo dentro da transação do cancelamento.
 */
export async function creditarCancelamentoEmTx(
  tx: Tx,
  reserva: typeof reservas.$inferSelect
): Promise<number> {
  if (!reserva.pacote_cliente_id || !reserva.horas_debitadas) return 0;

  const [pol] = await tx
    .select()
    .from(politicaCancelamento)
    .where(eq(politicaCancelamento.is_deleted, false))
    .orderBy(desc(politicaCancelamento.versao))
    .limit(1);

  const janelaMs = (pol?.janela_horas ?? 12) * 3_600_000;
  const dentroPrazo = reserva.inicio_em ? reserva.inicio_em.getTime() - Date.now() >= janelaMs : false;
  if (!dentroPrazo) return 0;

  const perc = (pol?.percentual_devolvido ?? 100) / 100;
  const horasCredito = Math.round(Number(reserva.horas_debitadas) * perc * 100) / 100;
  if (horasCredito <= 0) return 0;

  const [cp] = await tx
    .select()
    .from(clientesPacotes)
    .where(and(eq(clientesPacotes.id, reserva.pacote_cliente_id), eq(clientesPacotes.is_deleted, false)))
    .for("update");
  if (!cp) return 0;

  const novoSaldo = Math.round((Number(cp.horas_saldo) + horasCredito) * 100) / 100;
  // Não revive pacote cancelado/vencido: credita mas mantém o estado que impede o uso.
  const vencido = String(cp.valido_ate) < hojeSaoPaulo();
  const novoStatus = cp.status === "cancelado" ? "cancelado" : vencido ? "expirado" : "ativo";
  await tx
    .update(clientesPacotes)
    .set({
      horas_saldo: String(novoSaldo),
      horas_consumidas: String(Math.max(0, Number(cp.horas_consumidas) - horasCredito)),
      status: novoStatus,
      updated_at: new Date(),
    })
    .where(eq(clientesPacotes.id, cp.id));
  await tx.insert(clientesPacotesMovimentos).values({
    cliente_pacote_id: cp.id,
    reserva_id: reserva.id,
    tipo: "credito",
    horas: String(horasCredito),
    saldo_apos: String(novoSaldo),
    motivo: `Cancelamento dentro do prazo (${pol?.percentual_devolvido ?? 100}%)`,
  });
  return horasCredito;
}
