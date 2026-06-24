import { and, eq, gt, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { sincronizarReserva } from "@/lib/google/calendar";
import { registrarAuditoria } from "@/lib/audit/logger";
import { calcularJanela, ABRE_MIN, JORNADA_MIN } from "./disponibilidade";

/** Reservas que NÃO bloqueiam o horário (não contam como conflito). */
const STATUS_LIVRES = ["cancelada", "no_show", "rascunho"];
/** Teto de holds pendentes futuros por cliente — evita flood pelo chat. */
const MAX_HOLDS_PENDENTES = 3;

export interface SalaLivre {
  id: string;
  nome: string;
}

function janelaSanitizada(data: string, hora: string, duracaoMin: number): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return "Data inválida (use AAAA-MM-DD).";
  // Hora 00:00–23:59 (regex de formato aceitaria 19:99/25:00 — barramos aqui).
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(hora)) return "Hora inválida (use HH:MM, 24h).";
  // Data de CALENDÁRIO real: 2026-02-30 / 2026-13-15 passam no regex mas não existem.
  const [y, mo, d] = data.split("-").map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return "Data inválida (essa data não existe no calendário).";
  }
  if (!Number.isInteger(duracaoMin) || duracaoMin < 60 || duracaoMin % 30 !== 0) {
    return "Duração inválida (mínimo 60 min, em múltiplos de 30).";
  }
  const horaMin = Number(hora.slice(0, 2)) * 60 + Number(hora.slice(3, 5));
  if (horaMin < ABRE_MIN || horaMin + duracaoMin > ABRE_MIN + JORNADA_MIN) {
    return "Fora do horário de funcionamento (07h às 23h).";
  }
  return null;
}

/**
 * Salas livres para a janela informada (apenas leitura, sem sessão — uso da Hígia).
 * Fonte de verdade = nossas reservas no banco (anti-overbooking).
 */
export async function consultarDisponibilidadeAgente(
  data: string,
  hora: string,
  duracaoMin: number
): Promise<{ erro?: string; livres?: SalaLivre[] }> {
  const invalido = janelaSanitizada(data, hora, duracaoMin);
  if (invalido) return { erro: invalido };

  const { inicio, fim } = calcularJanela(data, hora, duracaoMin);
  if (inicio.getTime() <= Date.now()) return { erro: "Esse horário já passou — sugira uma data/hora futura." };

  const ativas = await db
    .select({ id: salas.id, nome: salas.nome })
    .from(salas)
    .where(and(eq(salas.is_deleted, false), eq(salas.ativa, true)));

  const ocupadas = await db
    .select({ sala_id: reservas.sala_id })
    .from(reservas)
    .where(
      and(
        eq(reservas.is_deleted, false),
        notInArray(reservas.status_reserva, STATUS_LIVRES),
        lt(reservas.inicio_em, fim),
        gt(reservas.fim_em, inicio)
      )
    );
  const ocupado = new Set(ocupadas.map((o) => o.sala_id));
  return { livres: ativas.filter((s) => !ocupado.has(s.id)) };
}

export interface AgendamentoOk {
  ok: true;
  reservaId: string;
  salaNome: string;
  data: string;
  hora: string;
  duracaoMin: number;
}

/**
 * Cria uma reserva PROVISÓRIA (hold) para o cliente da conversa — pendente de
 * pagamento via Pix. NÃO confirma pagamento nem debita pacote: quem confirma é a
 * equipe, após o comprovante. O `clienteId` vem do servidor (nunca do LLM).
 */
export async function agendarReservaAgente(input: {
  clienteId: string;
  data: string;
  hora: string;
  duracaoMin: number;
  finalidade?: string;
  salaId?: string;
}): Promise<AgendamentoOk | { erro: string }> {
  const { clienteId, data, hora, duracaoMin, finalidade } = input;
  const invalido = janelaSanitizada(data, hora, duracaoMin);
  if (invalido) return { erro: invalido };

  const { inicio, fim } = calcularJanela(data, hora, duracaoMin);
  if (inicio.getTime() <= Date.now()) return { erro: "Esse horário já passou — sugira uma data/hora futura." };

  // Cliente precisa existir e estar ativo.
  const [cli] = await db
    .select({ id: clientes.id, bloqueado: clientes.bloqueado })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return { erro: "Cliente não encontrado." };
  if (cli.bloqueado) return { erro: "Cliente bloqueado — encaminhe para a equipe." };

  try {
    const reserva = await db.transaction(async (tx) => {
      // Serializa por cliente (mesmo padrão da ingestão): impede holds duplicados em
      // corrida — retry da fila pós-agendamento, inline concorrente ou 2 tool_use no turno.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clienteId}))`);

      // IDEMPOTÊNCIA: já existe hold pendente do MESMO cliente para ESTA janela? Reaproveita.
      const [existente] = await tx
        .select({ id: reservas.id, sala_id: reservas.sala_id })
        .from(reservas)
        .where(
          and(
            eq(reservas.cliente_id, clienteId),
            eq(reservas.is_deleted, false),
            eq(reservas.status_pagamento, "pendente"),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            eq(reservas.inicio_em, inicio),
            eq(reservas.fim_em, fim)
          )
        );
      if (existente) {
        const [s] = await tx.select({ nome: salas.nome }).from(salas).where(eq(salas.id, existente.sala_id));
        return { id: existente.id, salaNome: s?.nome ?? "sala reservada", reaproveitado: true };
      }

      // Anti-flood (agora DENTRO do lock = atômico): teto de holds pendentes futuros.
      const holds = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(
          and(
            eq(reservas.cliente_id, clienteId),
            eq(reservas.is_deleted, false),
            eq(reservas.status_pagamento, "pendente"),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            gt(reservas.fim_em, new Date())
          )
        );
      if (holds.length >= MAX_HOLDS_PENDENTES) {
        throw new ReservaIndisponivel(
          "Cliente já tem reservas provisórias demais aguardando pagamento — encaminhe para a equipe."
        );
      }

      // Salas ativas livres na janela (constraint GiST é o backstop final).
      const ativas = await tx
        .select({ id: salas.id, nome: salas.nome, prioridade: salas.prioridade_alocacao })
        .from(salas)
        .where(and(eq(salas.is_deleted, false), eq(salas.ativa, true)));
      const ocupadas = await tx
        .select({ sala_id: reservas.sala_id })
        .from(reservas)
        .where(
          and(
            eq(reservas.is_deleted, false),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            lt(reservas.inicio_em, fim),
            gt(reservas.fim_em, inicio)
          )
        );
      const ocupado = new Set(ocupadas.map((o) => o.sala_id));
      const livres = ativas
        .filter((s) => !ocupado.has(s.id))
        .sort((a, b) => (a.prioridade ?? 99) - (b.prioridade ?? 99));

      // Se pediram uma sala específica, respeita (se livre); senão pega a 1ª por prioridade.
      const escolhida = input.salaId ? livres.find((s) => s.id === input.salaId) : livres[0];
      if (!escolhida) {
        if (input.salaId) throw new ReservaIndisponivel("A sala pedida não está livre nesse horário.");
        throw new ReservaIndisponivel("Nenhuma sala livre nesse horário.");
      }

      const [nova] = await tx
        .insert(reservas)
        .values({
          sala_id: escolhida.id,
          cliente_id: clienteId,
          titulo: finalidade?.trim() || "Reserva via Hígia",
          data,
          hora,
          duracao_min: duracaoMin,
          inicio_em: inicio,
          fim_em: fim,
          tipo: "uso_sala",
          status_reserva: "pendente",
          status_pagamento: "pendente",
          origem: "higia",
          modalidade: "presencial",
        })
        .returning();
      return { id: nova.id, salaNome: escolhida.nome, reaproveitado: false };
    });

    // Auditoria + Google só para hold NOVO (reaproveitado já foi registrado/sincronizado).
    if (!reserva.reaproveitado) {
      await registrarAuditoria({
        acao: "criar",
        entidade: "reservas",
        registroId: reserva.id,
        detalhes: `Hígia agendou (hold) ${data} ${hora} (${duracaoMin}min) em ${reserva.salaNome} — pendente de Pix`,
      }).catch(() => undefined);
      await sincronizarReserva(reserva.id).catch(() => undefined);
    }

    return { ok: true, reservaId: reserva.id, salaNome: reserva.salaNome, data, hora, duracaoMin };
  } catch (e: unknown) {
    if (e instanceof ReservaIndisponivel) return { erro: e.message };
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23P01") {
      return { erro: "Horário acabou de ser ocupado — ofereça outro horário." };
    }
    return { erro: "Não consegui registrar a reserva agora. Encaminhe para a equipe." };
  }
}

class ReservaIndisponivel extends Error {}
