import { and, asc, eq, gt, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { sincronizarReserva, removerEventoReserva } from "@/lib/google/calendar";
import { registrarAuditoria } from "@/lib/audit/logger";
import { creditarCancelamentoEmTx } from "./pacote-saldo";
import { calcularJanela } from "./disponibilidade";
import { janelaSanitizada, STATUS_LIVRES } from "./agendar";

class ReservaAgenteError extends Error {}

export interface ReservaResumo {
  id: string;
  sala: string;
  data: string;
  hora: string;
  duracaoMin: number;
  status: string;
}

/** Reservas FUTURAS ativas do cliente (para a Hígia saber qual cancelar/alterar). */
export async function listarReservasFuturasCliente(clienteId: string): Promise<ReservaResumo[]> {
  const rows = await db
    .select({
      id: reservas.id,
      sala: salas.nome,
      data: reservas.data,
      hora: reservas.hora,
      duracao_min: reservas.duracao_min,
      status: reservas.status_reserva,
    })
    .from(reservas)
    .innerJoin(salas, eq(reservas.sala_id, salas.id))
    .where(
      and(
        eq(reservas.cliente_id, clienteId),
        eq(reservas.is_deleted, false),
        notInArray(reservas.status_reserva, ["cancelada", "no_show", "rascunho"]),
        gt(reservas.fim_em, new Date())
      )
    )
    .orderBy(asc(reservas.inicio_em));
  return rows.map((r) => ({
    id: r.id,
    sala: r.sala,
    data: r.data,
    hora: (r.hora ?? "").slice(0, 5),
    duracaoMin: r.duracao_min,
    status: r.status,
  }));
}

/**
 * Cancela uma reserva DO cliente da conversa (valida posse). Aplica a política de
 * cancelamento: dentro do prazo, credita as horas de volta no pacote. Libera o horário
 * e remove o evento do Google. O `clienteId` vem do servidor (nunca do LLM).
 */
export async function cancelarReservaAgente(
  clienteId: string,
  reservaId: string
): Promise<{ ok?: true; erro?: string; mensagem?: string; horasCreditadas?: number }> {
  try {
    const r = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clienteId}))`);
      const [rv] = await tx
        .select()
        .from(reservas)
        .where(and(eq(reservas.id, reservaId), eq(reservas.is_deleted, false)))
        .for("update");
      if (!rv) throw new ReservaAgenteError("Não encontrei essa reserva.");
      if (rv.cliente_id !== clienteId) throw new ReservaAgenteError("Essa reserva não é sua.");
      if (rv.status_reserva === "cancelada") return { jaCancelada: true, horasCreditadas: 0 };
      if (rv.status_reserva === "concluida" || rv.status_reserva === "no_show") {
        throw new ReservaAgenteError("Essa reserva já passou — não dá pra cancelar.");
      }
      const horasCreditadas = await creditarCancelamentoEmTx(tx, rv);
      await tx
        .update(reservas)
        .set({ status_reserva: "cancelada", updated_at: new Date() })
        .where(eq(reservas.id, rv.id));
      return { jaCancelada: false, horasCreditadas };
    });

    if (!r.jaCancelada) {
      await registrarAuditoria({
        acao: "atualizar",
        entidade: "reservas",
        registroId: reservaId,
        detalhes: `Hígia cancelou reserva${r.horasCreditadas > 0 ? ` (creditou ${r.horasCreditadas}h no pacote)` : ""}.`,
      }).catch(() => undefined);
      await removerEventoReserva(reservaId).catch(() => undefined);
    }

    const mensagem =
      r.horasCreditadas > 0
        ? `Reserva cancelada! Como foi com antecedência, devolvi ${r.horasCreditadas}h pro seu pacote 🙌`
        : "Reserva cancelada! Qualquer coisa, é só me chamar 😊";
    return { ok: true, mensagem, horasCreditadas: r.horasCreditadas };
  } catch (e: unknown) {
    if (e instanceof ReservaAgenteError) return { erro: e.message };
    return { erro: "Não consegui cancelar agora — tente de novo em instantes." };
  }
}

/**
 * Remarca (altera data/hora) uma reserva DO cliente, MANTENDO a mesma duração e sala
 * (sem mexer no saldo). Checa disponibilidade da sala na nova janela e atualiza o Google.
 */
export async function alterarReservaAgente(
  clienteId: string,
  reservaId: string,
  novaData: string,
  novaHora: string
): Promise<{ ok?: true; erro?: string; mensagem?: string }> {
  try {
    const out = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clienteId}))`);
      const [rv] = await tx
        .select()
        .from(reservas)
        .where(and(eq(reservas.id, reservaId), eq(reservas.is_deleted, false)))
        .for("update");
      if (!rv) throw new ReservaAgenteError("Não encontrei essa reserva.");
      if (rv.cliente_id !== clienteId) throw new ReservaAgenteError("Essa reserva não é sua.");
      if (rv.status_reserva === "cancelada" || rv.status_reserva === "no_show") {
        throw new ReservaAgenteError("Essa reserva não está ativa.");
      }
      if (rv.status_reserva === "concluida") throw new ReservaAgenteError("Essa reserva já foi concluída.");

      const invalido = janelaSanitizada(novaData, novaHora, rv.duracao_min);
      if (invalido) throw new ReservaAgenteError(invalido);
      const { inicio, fim } = calcularJanela(novaData, novaHora, rv.duracao_min);
      if (inicio.getTime() <= Date.now()) throw new ReservaAgenteError("Esse horário já passou — escolha um futuro.");

      // Conflito na MESMA sala (excluindo a própria reserva).
      const conflito = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(
          and(
            eq(reservas.sala_id, rv.sala_id),
            eq(reservas.is_deleted, false),
            ne(reservas.id, rv.id),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            lt(reservas.inicio_em, fim),
            gt(reservas.fim_em, inicio)
          )
        );
      if (conflito.length > 0) {
        throw new ReservaAgenteError("Esse novo horário não está livre nessa sala. Quer tentar outro?");
      }
      const [s] = await tx.select({ nome: salas.nome }).from(salas).where(eq(salas.id, rv.sala_id));
      await tx
        .update(reservas)
        .set({ data: novaData, hora: novaHora, inicio_em: inicio, fim_em: fim, updated_at: new Date() })
        .where(eq(reservas.id, rv.id));
      return { sala: s?.nome ?? "sua sala" };
    });

    await registrarAuditoria({
      acao: "atualizar",
      entidade: "reservas",
      registroId: reservaId,
      detalhes: `Hígia remarcou reserva para ${novaData} ${novaHora}.`,
    }).catch(() => undefined);
    await sincronizarReserva(reservaId).catch(() => undefined); // atualiza o evento no Google

    return { ok: true, mensagem: `Pronto! Remarquei pra ${novaData} às ${novaHora} na ${out.sala} ✅` };
  } catch (e: unknown) {
    if (e instanceof ReservaAgenteError) return { erro: e.message };
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23P01") {
      return { erro: "Esse horário acabou de ser ocupado — tente outro." };
    }
    return { erro: "Não consegui remarcar agora — tente de novo." };
  }
}
