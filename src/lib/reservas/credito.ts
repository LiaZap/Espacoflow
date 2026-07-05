/**
 * Carteira de CRÉDITO em REAIS do cliente (UAT R08). Cancelar uma reserva paga (Pix/crédito)
 * DENTRO da política gera crédito em R$ com validade; reservar consome esse crédito
 * automaticamente (sem novo Pix quando cobre; diferença segue por Pix). Ledger append-only
 * em clientes_creditos — saldo = SUM(valor) das entradas não expiradas (piso 0).
 */
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientesCreditos, politicaCancelamento } from "@/lib/db/schema/pacotes";
import { pagamentos } from "@/lib/db/schema/pagamentos";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Saldo a partir das entradas do ledger (função PURA, testável), com contabilidade POR LOTE.
 * Cada crédito (valor>0) é um lote com validade; os débitos (valor<0) são consumidos FIFO
 * do lote que vence ANTES (usa-se o crédito mais perto de expirar primeiro). O saldo é a
 * sobra dos lotes AINDA VÁLIDOS (não expirados). Assim um débito de um lote já vencido não
 * "come" um lote ainda válido (evita o cliente perder crédito bom). Piso 0.
 */
export function calcularSaldoCredito(
  entradas: { valor: number | string; expira_em: Date | null }[],
  agoraMs: number
): number {
  const lotes = entradas
    .map((e) => ({ v: Number(e.valor), expiraMs: e.expira_em ? e.expira_em.getTime() : Infinity }))
    .filter((e) => Number.isFinite(e.v) && e.v > 0)
    .map((e) => ({ restante: e.v, expiraMs: e.expiraMs }))
    .sort((a, b) => a.expiraMs - b.expiraMs); // vence antes = consumido primeiro

  let debito = 0;
  for (const e of entradas) {
    const v = Number(e.valor);
    if (Number.isFinite(v) && v < 0) debito = round2(debito + -v);
  }
  for (const l of lotes) {
    if (debito <= 0) break;
    const usa = Math.min(l.restante, debito);
    l.restante = round2(l.restante - usa);
    debito = round2(debito - usa);
  }

  let saldo = 0;
  for (const l of lotes) {
    if (l.expiraMs > agoraMs) saldo = round2(saldo + l.restante); // só lote vigente conta
  }
  return Math.max(0, round2(saldo));
}

function somaValida(rows: { valor: string; expira_em: Date | null }[]): number {
  return calcularSaldoCredito(rows, Date.now());
}

/** Saldo de crédito em R$ do cliente (fora de transação — leitura para a Hígia). */
export async function saldoCreditoCliente(clienteId: string): Promise<number> {
  const rows = await db
    .select({ valor: clientesCreditos.valor, expira_em: clientesCreditos.expira_em })
    .from(clientesCreditos)
    .where(and(eq(clientesCreditos.cliente_id, clienteId), eq(clientesCreditos.is_deleted, false)));
  return somaValida(rows);
}

/** Saldo de crédito DENTRO da transação (usar com o advisory lock por cliente já tomado). */
export async function saldoCreditoEmTx(tx: Tx, clienteId: string): Promise<number> {
  const rows = await tx
    .select({ valor: clientesCreditos.valor, expira_em: clientesCreditos.expira_em })
    .from(clientesCreditos)
    .where(and(eq(clientesCreditos.cliente_id, clienteId), eq(clientesCreditos.is_deleted, false)));
  return somaValida(rows);
}

/** Debita crédito (R$) — entrada negativa no ledger. Chamado após inserir a reserva. */
export async function debitarCreditoEmTx(
  tx: Tx,
  params: { clienteId: string; valor: number; reservaId: string; motivo?: string }
): Promise<void> {
  const v = round2(params.valor);
  if (v <= 0) return;
  await tx.insert(clientesCreditos).values({
    cliente_id: params.clienteId,
    reserva_id: params.reservaId,
    tipo: "debito_reserva",
    valor: String(-v),
    expira_em: null,
    motivo: params.motivo ?? `Crédito aplicado na reserva ${params.reservaId}`,
  });
}

/** Total que o cliente efetivamente pagou por uma reserva (Pix confirmado + crédito usado). */
export async function valorPagoDaReservaEmTx(tx: Tx, reservaId: string): Promise<number> {
  const pgs = await tx
    .select({ valor: pagamentos.valor })
    .from(pagamentos)
    .where(
      and(
        eq(pagamentos.reserva_id, reservaId),
        eq(pagamentos.is_deleted, false),
        eq(pagamentos.status, "confirmado")
      )
    );
  const pix = pgs.reduce((a, p) => a + (p.valor != null ? Number(p.valor) : 0), 0);
  const creds = await tx
    .select({ valor: clientesCreditos.valor })
    .from(clientesCreditos)
    .where(
      and(
        eq(clientesCreditos.reserva_id, reservaId),
        eq(clientesCreditos.is_deleted, false),
        eq(clientesCreditos.tipo, "debito_reserva")
      )
    );
  const usado = creds.reduce((a, c) => a + Math.abs(Number(c.valor)), 0);
  return round2(pix + usado);
}

/**
 * Credita em R$ ao CANCELAR (reserva paga por Pix/crédito, NÃO por pacote), se dentro da
 * política (janela + %). Crédito com validade (validade_credito_dias). Retorna o valor
 * creditado (0 se nada). Tudo dentro da transação do cancelamento.
 */
export async function creditarCancelamentoReaisEmTx(
  tx: Tx,
  params: { clienteId: string; reservaId: string; inicioEm: Date | null }
): Promise<number> {
  const valorPago = await valorPagoDaReservaEmTx(tx, params.reservaId);
  if (valorPago <= 0) return 0;

  const [pol] = await tx
    .select()
    .from(politicaCancelamento)
    .where(eq(politicaCancelamento.is_deleted, false))
    .orderBy(desc(politicaCancelamento.versao))
    .limit(1);

  const janelaMs = (pol?.janela_horas ?? 12) * 3_600_000;
  const dentroPrazo = params.inicioEm ? params.inicioEm.getTime() - Date.now() >= janelaMs : false;
  if (!dentroPrazo) return 0;

  const perc = (pol?.percentual_devolvido ?? 100) / 100;
  const credito = round2(valorPago * perc);
  if (credito <= 0) return 0;

  const validadeDias = pol?.validade_credito_dias ?? 60;
  const expira = new Date(Date.now() + validadeDias * 24 * 3_600_000);
  await tx.insert(clientesCreditos).values({
    cliente_id: params.clienteId,
    reserva_id: params.reservaId,
    tipo: "credito_cancelamento",
    valor: String(credito),
    expira_em: expira,
    motivo: `Cancelamento dentro do prazo (${pol?.percentual_devolvido ?? 100}%)`,
  });
  return credito;
}
