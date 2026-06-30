import { and, asc, desc, eq, gt, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  clientesPacotes,
  clientesPacotesMovimentos,
  pacotes,
  politicaCancelamento,
} from "@/lib/db/schema/pacotes";
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
