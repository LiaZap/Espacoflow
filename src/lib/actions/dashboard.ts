"use server";

import { and, count, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { whatsappConversas } from "@/lib/db/schema/whatsapp";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { clientes } from "@/lib/db/schema/clientes";
import { exigirSessao } from "@/lib/auth";

function hojeSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

export async function obterKpis() {
  await exigirSessao();
  const hoje = hojeSaoPaulo();

  const [[reservasHoje], [conversasAbertas], [pixPendentes], [clientesTotal]] = await Promise.all([
    db
      .select({ n: count() })
      .from(reservas)
      .where(
        and(
          eq(reservas.is_deleted, false),
          eq(reservas.data, hoje),
          inArray(reservas.status_reserva, ["pendente", "confirmada"])
        )
      ),
    db
      .select({ n: count() })
      .from(whatsappConversas)
      .where(and(eq(whatsappConversas.is_deleted, false), inArray(whatsappConversas.status, ["higia", "humano"]))),
    db
      .select({ n: count() })
      .from(pagamentos)
      .where(and(eq(pagamentos.is_deleted, false), eq(pagamentos.status, "pendente"))),
    db.select({ n: count() }).from(clientes).where(eq(clientes.is_deleted, false)),
  ]);

  return {
    reservasHoje: reservasHoje?.n ?? 0,
    conversasAbertas: conversasAbertas?.n ?? 0,
    pixPendentes: pixPendentes?.n ?? 0,
    clientesTotal: clientesTotal?.n ?? 0,
  };
}
