"use server";

import { and, asc, desc, eq, gt, lt, notInArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { clientesPacotes, clientesPacotesMovimentos, politicaCancelamento } from "@/lib/db/schema/pacotes";
import { reservaSchema } from "@/lib/validators/reservas";
import { registrarAuditoria } from "@/lib/audit/logger";
import { calcularJanela, minutosParaHoras, ABRE_MIN, JORNADA_MIN } from "@/lib/reservas/disponibilidade";
import { sincronizarReserva, removerEventoReserva } from "@/lib/google/calendar";
import { exigirPermissao, primeiroErro } from "./_helpers";

class ReservaError extends Error {}

const STATUS_ATIVOS_EXCLUIR = ["cancelada", "no_show", "rascunho"];

export async function listarReservas() {
  await exigirPermissao("reservas", "ler");
  return db
    .select({
      id: reservas.id,
      titulo: reservas.titulo,
      sala_nome: salas.nome,
      cliente_nome: clientes.nome,
      data: reservas.data,
      hora: reservas.hora,
      duracao_min: reservas.duracao_min,
      tipo: reservas.tipo,
      status_reserva: reservas.status_reserva,
      status_pagamento: reservas.status_pagamento,
      inicio_em: reservas.inicio_em,
    })
    .from(reservas)
    .innerJoin(salas, eq(reservas.sala_id, salas.id))
    .innerJoin(clientes, eq(reservas.cliente_id, clientes.id))
    .where(eq(reservas.is_deleted, false))
    .orderBy(desc(reservas.inicio_em));
}

export type FormState = { erro?: string };

export async function criarReserva(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("reservas", "criar");

  const parsed = reservaSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  const { inicio, fim } = calcularJanela(d.data, d.hora, d.duracao_min);
  const horas = minutosParaHoras(d.duracao_min);

  try {
    const reserva = await db.transaction(async (tx) => {
      // 1) checagem de conflito (overlap) — o constraint GiST é o backstop final.
      const conflito = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(
          and(
            eq(reservas.sala_id, d.sala_id),
            eq(reservas.is_deleted, false),
            notInArray(reservas.status_reserva, STATUS_ATIVOS_EXCLUIR),
            lt(reservas.inicio_em, fim),
            gt(reservas.fim_em, inicio)
          )
        );
      if (conflito.length > 0) throw new ReservaError("Horário indisponível para esta sala.");

      let horasDebitadas: string | null = null;
      let statusReserva = "pendente";
      let statusPagamento = "pendente";
      let saldoApos = 0;

      // 2) débito de saldo (se pago por pacote)
      if (d.pacote_cliente_id) {
        const [cp] = await tx
          .select()
          .from(clientesPacotes)
          .where(and(eq(clientesPacotes.id, d.pacote_cliente_id), eq(clientesPacotes.is_deleted, false)))
          .for("update");
        if (!cp) throw new ReservaError("Pacote do cliente não encontrado.");
        if (cp.cliente_id !== d.cliente_id) throw new ReservaError("O pacote não pertence a este cliente.");
        const saldo = Number(cp.horas_saldo);
        if (saldo < horas) throw new ReservaError("Saldo de horas insuficiente neste pacote.");
        saldoApos = Math.round((saldo - horas) * 100) / 100;
        await tx
          .update(clientesPacotes)
          .set({
            horas_saldo: String(saldoApos),
            horas_consumidas: String(Number(cp.horas_consumidas) + horas),
            status: saldoApos <= 0 ? "esgotado" : "ativo",
            updated_at: new Date(),
            modified_by: sessao.userId,
          })
          .where(eq(clientesPacotes.id, cp.id));
        horasDebitadas = String(horas);
        statusReserva = "confirmada";
        statusPagamento = "pago";
      }

      const [nova] = await tx
        .insert(reservas)
        .values({
          sala_id: d.sala_id,
          cliente_id: d.cliente_id,
          pacote_cliente_id: d.pacote_cliente_id ?? null,
          titulo: d.titulo,
          data: d.data,
          hora: d.hora,
          duracao_min: d.duracao_min,
          inicio_em: inicio,
          fim_em: fim,
          tipo: d.tipo,
          status_reserva: statusReserva,
          status_pagamento: statusPagamento,
          origem: "manual",
          modalidade: d.modalidade,
          horas_debitadas: horasDebitadas,
          notas_internas: d.notas_internas ?? null,
          modified_by: sessao.userId,
        })
        .returning();

      if (d.pacote_cliente_id && horasDebitadas) {
        await tx.insert(clientesPacotesMovimentos).values({
          cliente_pacote_id: d.pacote_cliente_id,
          reserva_id: nova.id,
          tipo: "debito",
          horas: horasDebitadas,
          saldo_apos: String(saldoApos),
          motivo: `Reserva ${nova.id}`,
          modified_by: sessao.userId,
        });
      }
      return nova;
    });

    await registrarAuditoria({
      userId: sessao.userId,
      acao: "criar",
      entidade: "reservas",
      registroId: reserva.id,
      detalhes: `Reserva ${reserva.titulo} em ${d.data} ${d.hora} (${d.duracao_min}min)`,
      dadosNovos: reserva,
    });

    // Sincroniza no Google Calendar (best-effort; só age se a agenda estiver conectada).
    await sincronizarReserva(reserva.id).catch(() => undefined);
  } catch (e: unknown) {
    if (e instanceof ReservaError) return { erro: e.message };
    // 23P01 = exclusion_violation (constraint anti-overbooking)
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23P01") {
      return { erro: "Horário indisponível para esta sala (conflito de agenda)." };
    }
    return { erro: "Não foi possível criar a reserva. Tente novamente." };
  }

  revalidatePath("/reservas");
  redirect("/reservas");
}

/** Cancela a reserva aplicando a política (crédito de horas se dentro do prazo). */
export async function cancelarReserva(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("reservas", "atualizar");
  try {
    await db.transaction(async (tx) => {
      const [r] = await tx
        .select()
        .from(reservas)
        .where(and(eq(reservas.id, id), eq(reservas.is_deleted, false)))
        .for("update");
      if (!r) throw new ReservaError("Reserva não encontrada.");
      if (r.status_reserva === "cancelada") return;

      const [pol] = await tx
        .select()
        .from(politicaCancelamento)
        .where(eq(politicaCancelamento.is_deleted, false))
        .orderBy(desc(politicaCancelamento.versao))
        .limit(1);

      const janelaMs = (pol?.janela_horas ?? 12) * 3_600_000;
      const dentroPrazo = r.inicio_em ? r.inicio_em.getTime() - Date.now() >= janelaMs : false;

      if (r.pacote_cliente_id && r.horas_debitadas && dentroPrazo) {
        const perc = (pol?.percentual_devolvido ?? 100) / 100;
        const horasCredito = Math.round(Number(r.horas_debitadas) * perc * 100) / 100;
        const [cp] = await tx
          .select()
          .from(clientesPacotes)
          .where(eq(clientesPacotes.id, r.pacote_cliente_id))
          .for("update");
        if (cp) {
          const novoSaldo = Math.round((Number(cp.horas_saldo) + horasCredito) * 100) / 100;
          await tx
            .update(clientesPacotes)
            .set({
              horas_saldo: String(novoSaldo),
              horas_consumidas: String(Math.max(0, Number(cp.horas_consumidas) - horasCredito)),
              status: "ativo",
              updated_at: new Date(),
              modified_by: sessao.userId,
            })
            .where(eq(clientesPacotes.id, cp.id));
          await tx.insert(clientesPacotesMovimentos).values({
            cliente_pacote_id: cp.id,
            reserva_id: r.id,
            tipo: "credito",
            horas: String(horasCredito),
            saldo_apos: String(novoSaldo),
            motivo: `Cancelamento dentro do prazo (${pol?.percentual_devolvido ?? 100}%)`,
            modified_by: sessao.userId,
          });
        }
      }

      await tx
        .update(reservas)
        .set({ status_reserva: "cancelada", updated_at: new Date(), modified_by: sessao.userId })
        .where(eq(reservas.id, r.id));
    });
  } catch (e: unknown) {
    if (e instanceof ReservaError) return { erro: e.message };
    return { erro: "Não foi possível cancelar a reserva." };
  }

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "reservas",
    registroId: id,
    detalhes: "Cancelou reserva",
  });

  // Remove o evento do Google Calendar (best-effort).
  await removerEventoReserva(id).catch(() => undefined);
  revalidatePath("/reservas");
  return {};
}

/** Check-in: marca a reserva como concluída (compareceu) ou no_show (faltou). */
async function transicionarReserva(
  id: string,
  novoStatus: "concluida" | "no_show",
  rotulo: string
): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("reservas", "atualizar");
  try {
    await db.transaction(async (tx) => {
      const [rsv] = await tx
        .select()
        .from(reservas)
        .where(and(eq(reservas.id, id), eq(reservas.is_deleted, false)))
        .for("update");
      if (!rsv) throw new ReservaError("Reserva não encontrada.");
      if (rsv.status_reserva === "cancelada") throw new ReservaError("Reserva cancelada não pode receber check-in.");
      if (rsv.status_reserva === novoStatus) return;
      await tx
        .update(reservas)
        .set({ status_reserva: novoStatus, updated_at: new Date(), modified_by: sessao.userId })
        .where(eq(reservas.id, id));
    });
  } catch (e: unknown) {
    if (e instanceof ReservaError) return { erro: e.message };
    return { erro: "Não foi possível registrar o check-in." };
  }

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "reservas",
    registroId: id,
    detalhes: `Check-in: ${rotulo}`,
  });
  revalidatePath("/reservas");
  revalidatePath("/clientes");
  revalidatePath("/relatorios");
  return {};
}

export async function concluirReserva(id: string): Promise<{ erro?: string }> {
  return transicionarReserva(id, "concluida", "compareceu (concluída)");
}

export async function marcarNoShow(id: string): Promise<{ erro?: string }> {
  return transicionarReserva(id, "no_show", "não compareceu (no_show)");
}

export type SalaDisponibilidade = {
  id: string;
  nome: string;
  status: "livre" | "ocupado" | "indefinido";
};

/** Mapa ao vivo: status (livre/ocupado) de cada sala ativa para uma janela. */
export async function disponibilidadeSalas(
  data: string,
  hora: string,
  duracaoMin: number
): Promise<SalaDisponibilidade[]> {
  await exigirPermissao("reservas", "ler");

  const ativas = await db
    .select({ id: salas.id, nome: salas.nome })
    .from(salas)
    .where(and(eq(salas.is_deleted, false), eq(salas.ativa, true)))
    .orderBy(asc(salas.prioridade_alocacao), asc(salas.nome));

  const janelaValida =
    /^\d{4}-\d{2}-\d{2}$/.test(data) && /^\d{2}:\d{2}/.test(hora) && duracaoMin >= 60;
  if (!janelaValida) {
    return ativas.map((s) => ({ ...s, status: "indefinido" as const }));
  }

  const { inicio, fim } = calcularJanela(data, hora, duracaoMin);
  const ocupadas = await db
    .select({ sala_id: reservas.sala_id })
    .from(reservas)
    .where(
      and(
        eq(reservas.is_deleted, false),
        notInArray(reservas.status_reserva, STATUS_ATIVOS_EXCLUIR),
        lt(reservas.inicio_em, fim),
        gt(reservas.fim_em, inicio)
      )
    );
  const ocupadoSet = new Set(ocupadas.map((o) => o.sala_id));

  return ativas.map((s) => ({
    ...s,
    status: ocupadoSet.has(s.id) ? ("ocupado" as const) : ("livre" as const),
  }));
}

export type OcupacaoReserva = {
  id: string;
  cliente: string;
  hora: string;
  duracaoMin: number;
  status: string;
  inicioMin: number;
  fimMin: number;
};
export type OcupacaoSala = { id: string; nome: string; reservas: OcupacaoReserva[] };

/** Ocupação de todas as salas em um dia (para o quadro de ocupação da equipe). */
export async function ocupacaoDoDia(data: string): Promise<OcupacaoSala[]> {
  await exigirPermissao("reservas", "ler");

  const ativas = await db
    .select({ id: salas.id, nome: salas.nome })
    .from(salas)
    .where(and(eq(salas.is_deleted, false), eq(salas.ativa, true)))
    .orderBy(asc(salas.prioridade_alocacao), asc(salas.nome));

  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) {
    return ativas.map((s) => ({ ...s, reservas: [] }));
  }

  const rows = await db
    .select({
      id: reservas.id,
      sala_id: reservas.sala_id,
      cliente: clientes.nome,
      hora: reservas.hora,
      duracao: reservas.duracao_min,
      status: reservas.status_reserva,
    })
    .from(reservas)
    .innerJoin(clientes, eq(reservas.cliente_id, clientes.id))
    .where(
      and(
        eq(reservas.is_deleted, false),
        eq(reservas.data, data),
        notInArray(reservas.status_reserva, STATUS_ATIVOS_EXCLUIR)
      )
    )
    .orderBy(asc(reservas.hora));

  const porSala = new Map<string, OcupacaoReserva[]>();
  for (const r of rows) {
    const partes = r.hora.split(":");
    const abs = Number(partes[0]) * 60 + Number(partes[1] ?? 0);
    const inicioMin = Math.max(0, abs - ABRE_MIN);
    const fimMin = Math.min(JORNADA_MIN, inicioMin + r.duracao);
    const arr = porSala.get(r.sala_id) ?? [];
    arr.push({
      id: r.id,
      cliente: r.cliente,
      hora: r.hora.slice(0, 5),
      duracaoMin: r.duracao,
      status: r.status,
      inicioMin,
      fimMin,
    });
    porSala.set(r.sala_id, arr);
  }

  return ativas.map((s) => ({ ...s, reservas: porSala.get(s.id) ?? [] }));
}
