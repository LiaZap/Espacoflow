import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { registrarAuditoria } from "@/lib/audit/logger";
import { estornarCreditoReservaEmTx } from "./credito";

/** TTL de um hold (pré-reserva) sem pagamento antes de ser liberado, em minutos. */
const HOLD_TTL_MIN = Number(process.env.HOLD_TTL_MIN) || 45;
const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Libera holds ABANDONADOS: reservas da Hígia que ficaram "pendente/pendente" (o cliente nunca
 * mandou o comprovante) há mais de HOLD_TTL_MIN. Para cada uma, numa transação:
 *  - CLAIM atômico (UPDATE ... WHERE ainda pendente/pendente) → vira "cancelada". Isso serializa
 *    com a confirmação do comprovante por trava de linha: se o comprovante confirmou primeiro, o
 *    claim não pega; se o job cancelou primeiro, o comprovante (que re-checa status) não confirma.
 *  - ESTORNA o crédito eventualmente aplicado (hold com crédito parcial já debita o saldo) — senão
 *    o cliente perderia o crédito numa reserva que nunca se confirmou.
 *  - solta o pagamento Pix pendente vinculado (soft delete) para não poluir os relatórios.
 * "cancelada" já está em STATUS_LIVRES e fora do índice GiST → o horário volta a ficar livre no
 * app E no banco, sem overbooking. NÃO toca reservas pagas (nascem confirmada/pago) nem manuais
 * do painel (origem != higia). Chamado por um job repetível (a cada 15 min).
 */
export async function expirarHoldsPendentes(
  ttlMin = HOLD_TTL_MIN
): Promise<{ expirados: number; creditoEstornado: number }> {
  const corte = new Date(Date.now() - ttlMin * 60 * 1000);
  const candidatos = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(
      and(
        eq(reservas.is_deleted, false),
        eq(reservas.status_reserva, "pendente"),
        eq(reservas.status_pagamento, "pendente"),
        eq(reservas.origem, "higia"),
        lt(reservas.created_at, corte)
      )
    );

  let expirados = 0;
  let creditoEstornado = 0;
  for (const { id } of candidatos) {
    const r = await db.transaction(async (tx) => {
      // NÃO expira hold cujo cliente JÁ enviou comprovante (pagamento em_analise sob revisão da
      // equipe, ou confirmado) — só some holds realmente abandonados (nenhum comprovante).
      const [comComprovante] = await tx
        .select({ id: pagamentos.id })
        .from(pagamentos)
        .where(
          and(
            eq(pagamentos.reserva_id, id),
            eq(pagamentos.is_deleted, false),
            inArray(pagamentos.status, ["em_analise", "confirmado"])
          )
        )
        .limit(1);
      if (comComprovante) return { expirado: false, estorno: 0 };

      // Claim: só cancela se AINDA está pendente/pendente (trava de linha resolve a corrida
      // com a confirmação do comprovante, que também re-checa status ao confirmar).
      const claim = await tx
        .update(reservas)
        .set({
          status_reserva: "cancelada",
          updated_at: new Date(),
          notas_internas: sql`coalesce(${reservas.notas_internas} || ' | ', '') || 'Hold expirado (sem pagamento)'`,
        })
        .where(
          and(
            eq(reservas.id, id),
            eq(reservas.status_reserva, "pendente"),
            eq(reservas.status_pagamento, "pendente")
          )
        )
        .returning({ id: reservas.id });
      if (claim.length === 0) return { expirado: false, estorno: 0 };

      const estorno = await estornarCreditoReservaEmTx(tx, id);
      await tx
        .update(pagamentos)
        .set({ is_deleted: true, deleted_at: new Date(), updated_at: new Date() })
        .where(and(eq(pagamentos.reserva_id, id), eq(pagamentos.status, "pendente"), eq(pagamentos.is_deleted, false)));
      return { expirado: true, estorno };
    });

    if (r.expirado) {
      expirados += 1;
      creditoEstornado = round2(creditoEstornado + r.estorno);
      await registrarAuditoria({
        acao: "atualizar",
        entidade: "reservas",
        registroId: id,
        detalhes: `Hold expirado (sem pagamento após ${ttlMin} min) — horário liberado${
          r.estorno > 0 ? `; R$ ${r.estorno.toFixed(2)} de crédito estornado` : ""
        }.`,
      }).catch(() => undefined);
    }
  }
  return { expirados, creditoEstornado };
}
