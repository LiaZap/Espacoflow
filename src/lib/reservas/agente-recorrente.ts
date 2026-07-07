import { and, asc, eq, gt, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { sincronizarReserva, removerEventoReserva } from "@/lib/google/calendar";
import { registrarAuditoria } from "@/lib/audit/logger";
import { creditarCancelamentoEmTx, ajustarSaldoPorDeltaEmTx, SaldoError } from "./pacote-saldo";
import { creditarCancelamentoReaisEmTx } from "./credito";
import { calcularJanela } from "./disponibilidade";
import { janelaSanitizada, STATUS_LIVRES, casaSalaNome } from "./agendar";

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
      if (rv.status_reserva === "cancelada") return { jaCancelada: true, horasCreditadas: 0, reaisCreditados: 0 };
      if (rv.status_reserva === "concluida" || rv.status_reserva === "no_show") {
        throw new ReservaAgenteError("Essa reserva já passou — não dá pra cancelar.");
      }
      const horasCreditadas = await creditarCancelamentoEmTx(tx, rv);
      // Reserva paga por Pix/crédito (não por pacote) → crédito em REAIS dentro da política.
      const reaisCreditados = rv.pacote_cliente_id
        ? 0
        : await creditarCancelamentoReaisEmTx(tx, { clienteId, reservaId: rv.id, inicioEm: rv.inicio_em });
      await tx
        .update(reservas)
        .set({ status_reserva: "cancelada", updated_at: new Date() })
        .where(eq(reservas.id, rv.id));
      return { jaCancelada: false, horasCreditadas, reaisCreditados };
    });

    if (!r.jaCancelada) {
      const detCredito =
        r.horasCreditadas > 0
          ? ` (creditou ${r.horasCreditadas}h no pacote)`
          : r.reaisCreditados > 0
            ? ` (creditou R$ ${r.reaisCreditados.toFixed(2)} de crédito)`
            : "";
      await registrarAuditoria({
        acao: "atualizar",
        entidade: "reservas",
        registroId: reservaId,
        detalhes: `Hígia cancelou reserva${detCredito}.`,
      }).catch(() => undefined);
      await removerEventoReserva(reservaId).catch(() => undefined);
    }

    let mensagem: string;
    if (r.horasCreditadas > 0) {
      mensagem = `Reserva cancelada! Como foi com antecedência, devolvi ${r.horasCreditadas}h pro seu pacote 🙌`;
    } else if (r.reaisCreditados > 0) {
      mensagem = `Reserva cancelada! Como foi com antecedência, você ficou com R$ ${r.reaisCreditados
        .toFixed(2)
        .replace(".", ",")} de crédito pra usar numa próxima reserva 🙌`;
    } else {
      mensagem = "Reserva cancelada! Qualquer coisa, é só me chamar 😊";
    }
    return { ok: true, mensagem, horasCreditadas: r.horasCreditadas };
  } catch (e: unknown) {
    if (e instanceof ReservaAgenteError) return { erro: e.message };
    return { erro: "Não consegui cancelar agora — tente de novo em instantes." };
  }
}

/**
 * Altera uma reserva DO cliente: remarca data/hora, troca de sala E/OU muda a DURAÇÃO.
 * Campos omitidos ficam como estão. Checa conflito na sala destino e atualiza o Google.
 * Quando a reserva foi paga por PACOTE e a duração muda, recalcula o saldo (devolve horas se
 * diminuiu, debita mais se aumentou — com checagem de saldo). Para reserva avulsa (Pix/crédito)
 * a mudança de duração é recusada (o valor muda; o cliente cancela e refaz). A Hígia resolve
 * troca de sala sozinha (não escala).
 */
export async function alterarReservaAgente(
  clienteId: string,
  reservaId: string,
  opts: { novaData?: string; novaHora?: string; novaSalaNome?: string; novaDuracaoMin?: number }
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

      // Campos omitidos mantêm o valor atual da reserva.
      const dataAlvo = opts.novaData?.trim() || rv.data;
      const horaAlvo = opts.novaHora?.trim() || (rv.hora ?? "").slice(0, 5);
      const duracaoAlvo = opts.novaDuracaoMin != null ? opts.novaDuracaoMin : rv.duracao_min;

      // Resolve a sala destino (troca de sala) ou mantém a atual.
      let salaAlvoId = rv.sala_id;
      let salaAlvoNome: string | undefined;
      if (opts.novaSalaNome?.trim()) {
        const ativas = await tx
          .select({ id: salas.id, nome: salas.nome })
          .from(salas)
          .where(and(eq(salas.is_deleted, false), eq(salas.ativa, true)));
        const alvo = ativas.find((s) => casaSalaNome(s.nome, opts.novaSalaNome!));
        if (!alvo) throw new ReservaAgenteError(`Não encontrei a sala "${opts.novaSalaNome}". Me diz qual sala você quer.`);
        salaAlvoId = alvo.id;
        salaAlvoNome = alvo.nome;
      }

      const mudouSala = salaAlvoId !== rv.sala_id;
      const mudouHorario = dataAlvo !== rv.data || horaAlvo !== (rv.hora ?? "").slice(0, 5);
      const mudouDuracao = duracaoAlvo !== rv.duracao_min;
      if (!mudouSala && !mudouHorario && !mudouDuracao) {
        throw new ReservaAgenteError("Me diz o que você quer mudar: a data/horário, a sala ou a duração?");
      }

      // Mudar a DURAÇÃO de uma reserva avulsa (Pix/crédito) muda o valor — recusa (cliente refaz).
      if (mudouDuracao && !rv.pacote_cliente_id) {
        throw new ReservaAgenteError(
          "Pra mudar a duração dessa reserva o valor muda. O jeito mais seguro é cancelar essa e fazer uma nova reserva com a duração certa 😊"
        );
      }

      const invalido = janelaSanitizada(dataAlvo, horaAlvo, duracaoAlvo);
      if (invalido) throw new ReservaAgenteError(invalido);
      const { inicio, fim } = calcularJanela(dataAlvo, horaAlvo, duracaoAlvo);
      if (inicio.getTime() <= Date.now()) throw new ReservaAgenteError("Esse horário já passou — escolha um futuro.");

      // Conflito na sala DESTINO (excluindo a própria reserva).
      const conflito = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(
          and(
            eq(reservas.sala_id, salaAlvoId),
            eq(reservas.is_deleted, false),
            ne(reservas.id, rv.id),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            lt(reservas.inicio_em, fim),
            gt(reservas.fim_em, inicio)
          )
        );
      if (conflito.length > 0) {
        throw new ReservaAgenteError(
          mudouSala
            ? "Essa sala não está livre nesse horário. Quer que eu veja outra sala ou outro horário?"
            : "Esse novo horário não está livre nessa sala. Quer tentar outro?"
        );
      }
      if (!salaAlvoNome) {
        const [s] = await tx.select({ nome: salas.nome }).from(salas).where(eq(salas.id, salaAlvoId));
        salaAlvoNome = s?.nome ?? "sua sala";
      }

      // Recalcula o saldo do pacote quando a duração mudou (reserva paga por pacote).
      let deltaHoras: number | null = null;
      let saldoApos: number | null = null;
      let horasNovas: number | null = null;
      if (mudouDuracao && rv.pacote_cliente_id && rv.horas_debitadas) {
        horasNovas = Math.round((duracaoAlvo / 60) * 100) / 100;
        deltaHoras = Math.round((horasNovas - Number(rv.horas_debitadas)) * 100) / 100;
        if (deltaHoras !== 0) {
          const aj = await ajustarSaldoPorDeltaEmTx(tx, {
            pacoteClienteId: rv.pacote_cliente_id,
            clienteId,
            reservaId: rv.id,
            deltaHoras,
          });
          saldoApos = aj.saldoApos;
        }
      }

      await tx
        .update(reservas)
        .set({
          data: dataAlvo,
          hora: horaAlvo,
          duracao_min: duracaoAlvo,
          inicio_em: inicio,
          fim_em: fim,
          sala_id: salaAlvoId,
          ...(horasNovas != null ? { horas_debitadas: String(horasNovas) } : {}),
          updated_at: new Date(),
        })
        .where(eq(reservas.id, rv.id));
      return { sala: salaAlvoNome, data: dataAlvo, hora: horaAlvo, duracaoMin: duracaoAlvo, mudouSala, mudouDuracao, deltaHoras, saldoApos };
    });

    const ajusteSaldo =
      out.deltaHoras != null && out.deltaHoras !== 0 && out.saldoApos != null
        ? out.deltaHoras < 0
          ? ` (devolveu ${Math.abs(out.deltaHoras)}h ao pacote, saldo ${out.saldoApos}h)`
          : ` (debitou +${out.deltaHoras}h do pacote, saldo ${out.saldoApos}h)`
        : "";
    await registrarAuditoria({
      acao: "atualizar",
      entidade: "reservas",
      registroId: reservaId,
      detalhes: `Hígia alterou reserva para ${out.data} ${out.hora} (${formatarDuracao(out.duracaoMin)}) na ${out.sala}${out.mudouSala ? " (trocou de sala)" : ""}${ajusteSaldo}.`,
    }).catch(() => undefined);
    await sincronizarReserva(reservaId).catch(() => undefined); // atualiza o evento no Google

    let mensagem = `Pronto! Sua reserva agora é ${out.data} às ${out.hora} na ${out.sala}`;
    if (out.mudouDuracao) mensagem += ` (${formatarDuracao(out.duracaoMin)})`;
    if (out.deltaHoras != null && out.deltaHoras !== 0 && out.saldoApos != null) {
      mensagem +=
        out.deltaHoras < 0
          ? `. Devolvi ${Math.abs(out.deltaHoras)}h pro seu pacote — saldo agora: ${out.saldoApos}h`
          : `. Debitei mais ${out.deltaHoras}h do seu pacote — saldo agora: ${out.saldoApos}h`;
    }
    mensagem += " ✅";
    return { ok: true, mensagem };
  } catch (e: unknown) {
    if (e instanceof ReservaAgenteError || e instanceof SaldoError) return { erro: e.message };
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23P01") {
      return { erro: "Esse horário acabou de ser ocupado — tente outro." };
    }
    return { erro: "Não consegui alterar agora — tente de novo." };
  }
}

/** Formata minutos como "2h" ou "1h30" (para a mensagem/auditoria de alteração). */
function formatarDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, "0")}`;
}
