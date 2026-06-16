"use server";

import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { salas } from "@/lib/db/schema/salas";
import { exigirPermissao } from "./_helpers";

export type Serie = { label: string; valor: number };

function ultimosDias(n: number): string[] {
  const baseStr = new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const dias: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(`${baseStr}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - i);
    dias.push(d.toISOString().slice(0, 10));
  }
  return dias;
}

const rotuloDia = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

export async function dadosRelatorios() {
  await exigirPermissao("relatorios", "ler");
  const dias = ultimosDias(14);
  const inicio = dias[0];

  const [rsv14, rsvAll, pgs, sls] = await Promise.all([
    db
      .select({ data: reservas.data })
      .from(reservas)
      .where(and(eq(reservas.is_deleted, false), gte(reservas.data, inicio))),
    db
      .select({ status: reservas.status_reserva, sala_id: reservas.sala_id })
      .from(reservas)
      .where(eq(reservas.is_deleted, false)),
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

  const reservasPorDia: Serie[] = dias.map((d) => ({
    label: rotuloDia(d),
    valor: rsv14.filter((r) => r.data === d).length,
  }));

  const receitaPorDia: Serie[] = dias.map((d) => {
    const total = pgs
      .filter((p) => p.pago_em && new Date(p.pago_em).toISOString().slice(0, 10) === d)
      .reduce((a, p) => a + Number(p.valor ?? 0), 0);
    return { label: rotuloDia(d), valor: Math.round(total) };
  });

  const STATUS = ["pendente", "confirmada", "concluida", "cancelada", "no_show"];
  const porStatus: Serie[] = STATUS.map((s) => ({
    label: s,
    valor: rsvAll.filter((r) => r.status === s).length,
  }));

  const porSala: Serie[] = sls.map((s) => ({
    label: s.nome,
    valor: rsvAll.filter((r) => r.sala_id === s.id).length,
  }));

  const receitaTotal = pgs.reduce((a, p) => a + Number(p.valor ?? 0), 0);
  const concl = rsvAll.filter((r) => r.status === "concluida").length;
  const noshow = rsvAll.filter((r) => r.status === "no_show").length;
  const comparecimento = concl + noshow > 0 ? Math.round((concl / (concl + noshow)) * 100) : null;

  return {
    reservasPorDia,
    receitaPorDia,
    porStatus,
    porSala,
    kpis: {
      reservas14d: rsv14.length,
      reservasTotal: rsvAll.length,
      receitaTotalCentavos: Math.round(receitaTotal * 100),
      comparecimento,
    },
  };
}
