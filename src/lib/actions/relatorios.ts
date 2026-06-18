"use server";

import { and, asc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { exigirPermissao } from "./_helpers";

export type Serie = { label: string; valor: number };

function hojeISO(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}
function ehISO(s?: string): boolean {
  return Boolean(s && /^\d{4}-\d{2}-\d{2}$/.test(s));
}

/** Normaliza o período: default = últimos 14 dias; ordena de/até. */
function normalizarPeriodo(opts?: { de?: string; ate?: string }): { de: string; ate: string } {
  const ate = ehISO(opts?.ate) ? (opts!.ate as string) : hojeISO();
  let de = ehISO(opts?.de) ? (opts!.de as string) : "";
  if (!de) {
    const d = new Date(`${ate}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 13);
    de = d.toISOString().slice(0, 10);
  }
  if (de > ate) return { de: ate, ate: de };
  return { de, ate };
}

function diasEntre(de: string, ate: string, max = 92): string[] {
  const dias: string[] = [];
  let d = new Date(`${de}T00:00:00Z`);
  const fim = new Date(`${ate}T00:00:00Z`);
  while (d <= fim && dias.length < max) {
    dias.push(d.toISOString().slice(0, 10));
    const proximo = new Date(d);
    proximo.setUTCDate(proximo.getUTCDate() + 1);
    d = proximo;
  }
  return dias;
}

const rotuloDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;
const dataDePago = (ts: Date | null) => (ts ? new Date(ts).toISOString().slice(0, 10) : null);

export async function dadosRelatorios(opts?: { de?: string; ate?: string }) {
  await exigirPermissao("relatorios", "ler");
  const { de, ate } = normalizarPeriodo(opts);
  const dias = diasEntre(de, ate);

  const [rsv, pgs, sls] = await Promise.all([
    db
      .select({ data: reservas.data, status: reservas.status_reserva, sala_id: reservas.sala_id })
      .from(reservas)
      .where(and(eq(reservas.is_deleted, false), gte(reservas.data, de), lte(reservas.data, ate))),
    db
      .select({ pago_em: pagamentos.pago_em, valor: pagamentos.valor })
      .from(pagamentos)
      .where(and(eq(pagamentos.is_deleted, false), eq(pagamentos.status, "confirmado"))),
    db
      .select({ id: salas.id, nome: salas.nome })
      .from(salas)
      .where(eq(salas.is_deleted, false))
      .orderBy(asc(salas.prioridade_alocacao)),
  ]);

  const pgsPeriodo = pgs.filter((p) => {
    const d = dataDePago(p.pago_em);
    return d && d >= de && d <= ate;
  });

  const reservasPorDia: Serie[] = dias.map((d) => ({
    label: rotuloDia(d),
    valor: rsv.filter((r) => r.data === d).length,
  }));

  const receitaPorDia: Serie[] = dias.map((d) => {
    const total = pgsPeriodo
      .filter((p) => dataDePago(p.pago_em) === d)
      .reduce((a, p) => a + Number(p.valor ?? 0), 0);
    return { label: rotuloDia(d), valor: Math.round(total) };
  });

  const STATUS = ["pendente", "confirmada", "concluida", "cancelada", "no_show"];
  const porStatus: Serie[] = STATUS.map((s) => ({
    label: s,
    valor: rsv.filter((r) => r.status === s).length,
  }));

  const porSala: Serie[] = sls.map((s) => ({
    label: s.nome,
    valor: rsv.filter((r) => r.sala_id === s.id).length,
  }));

  const receita = pgsPeriodo.reduce((a, p) => a + Number(p.valor ?? 0), 0);
  const concl = rsv.filter((r) => r.status === "concluida").length;
  const noshow = rsv.filter((r) => r.status === "no_show").length;
  const comparecimento = concl + noshow > 0 ? Math.round((concl / (concl + noshow)) * 100) : null;

  return {
    periodo: { de, ate },
    reservasPorDia,
    receitaPorDia,
    porStatus,
    porSala,
    kpis: {
      reservasPeriodo: rsv.length,
      receitaCentavos: Math.round(receita * 100),
      comparecimento,
      concluidas: concl,
    },
  };
}

/** Lista enxuta de clientes (id + nome) para o seletor do relatório. */
export async function clientesParaSelect() {
  await exigirPermissao("relatorios", "ler");
  return db
    .select({ id: clientes.id, nome: clientes.nome })
    .from(clientes)
    .where(eq(clientes.is_deleted, false))
    .orderBy(asc(clientes.nome));
}

/** Relatório de UM cliente no período: reservas, comparecimentos, faltas, valor pago. */
export async function relatorioCliente(clienteId: string, opts?: { de?: string; ate?: string }) {
  await exigirPermissao("relatorios", "ler");
  if (!clienteId) return null;
  const { de, ate } = normalizarPeriodo(opts);

  const [cli] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return null;

  const lista = await db
    .select({
      data: reservas.data,
      hora: reservas.hora,
      titulo: reservas.titulo,
      status: reservas.status_reserva,
      status_pag: reservas.status_pagamento,
      sala: salas.nome,
    })
    .from(reservas)
    .innerJoin(salas, eq(reservas.sala_id, salas.id))
    .where(
      and(
        eq(reservas.is_deleted, false),
        eq(reservas.cliente_id, clienteId),
        gte(reservas.data, de),
        lte(reservas.data, ate)
      )
    )
    .orderBy(asc(reservas.data), asc(reservas.hora));

  const pgs = await db
    .select({ valor: pagamentos.valor, pago_em: pagamentos.pago_em })
    .from(pagamentos)
    .where(
      and(
        eq(pagamentos.is_deleted, false),
        eq(pagamentos.cliente_id, clienteId),
        eq(pagamentos.status, "confirmado")
      )
    );
  const valorPago = pgs
    .filter((p) => {
      const d = dataDePago(p.pago_em);
      return d && d >= de && d <= ate;
    })
    .reduce((a, p) => a + Number(p.valor ?? 0), 0);

  return {
    cliente: { id: cli.id, nome: cli.nome, telefone: cli.telefone, status_lead: cli.status_lead },
    periodo: { de, ate },
    reservas: lista,
    totais: {
      reservas: lista.length,
      comparecimentos: lista.filter((r) => r.status === "concluida").length,
      faltas: lista.filter((r) => r.status === "no_show").length,
      canceladas: lista.filter((r) => r.status === "cancelada").length,
      valorPagoCentavos: Math.round(valorPago * 100),
    },
  };
}
