import { and, eq, gt, inArray, lt, notInArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { sincronizarReserva } from "@/lib/google/calendar";
import { registrarAuditoria } from "@/lib/audit/logger";
import { calcularJanela, ABRE_MIN, JORNADA_MIN } from "./disponibilidade";
import { debitarPacoteEmTx, registrarDebitoEmTx, SaldoError } from "./pacote-saldo";
import { saldoCreditoEmTx, debitarCreditoEmTx } from "./credito";

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Reservas que NÃO bloqueiam o horário (não contam como conflito). */
export const STATUS_LIVRES = ["cancelada", "no_show", "rascunho"];
/** Teto de holds pendentes futuros por cliente — backstop anti-runaway (não atrapalha
 * lotes reais: um cliente pode agendar várias sessões na mesma conversa). */
const MAX_HOLDS_PENDENTES = 30;

export interface SalaLivre {
  id: string;
  nome: string;
}

/**
 * Ordena salas livres pela preferência de mesa e depois pela prioridade de alocação.
 * - precisaMesa === true  → salas COM mesa primeiro;
 * - precisaMesa === false → salas SEM mesa primeiro (ex.: psicólogo → Sala 02);
 * - precisaMesa undefined  → só prioridade.
 * Nunca bloqueia: a sala "errada" fica no fim, mas segue elegível se for a única livre.
 */
export function ordenarSalasPorPreferencia<T extends { prioridade: number | null; tem_mesa: boolean }>(
  livres: T[],
  precisaMesa?: boolean
): T[] {
  const pref = (s: T): number => {
    if (precisaMesa === true) return s.tem_mesa ? 0 : 1;
    if (precisaMesa === false) return s.tem_mesa ? 1 : 0;
    return 0;
  };
  return [...livres].sort((a, b) => pref(a) - pref(b) || (a.prioridade ?? 99) - (b.prioridade ?? 99));
}

/**
 * Casa o nome da sala pedido pelo cliente com o nome cadastrado, tolerante a variações:
 * "Sala 03" ~ "Sala Privativa 03" ~ "03" ~ "3" (compara o NÚMERO da sala) e também
 * por igualdade/inclusão do texto normalizado. Serve p/ honrar a escolha explícita do cliente.
 */
export function casaSalaNome(nome: string, pedido: string): boolean {
  const norm = (s: string) =>
    (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  const n = norm(nome);
  const p = norm(pedido);
  if (!p) return false;
  if (n === p) return true;
  const numN = nome.match(/\d+/)?.[0];
  const numP = pedido.match(/\d+/)?.[0];
  if (numN && numP && parseInt(numN, 10) === parseInt(numP, 10)) return true;
  return n.includes(p) || p.includes(n);
}

export function janelaSanitizada(data: string, hora: string, duracaoMin: number): string | null {
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
  /** true se a reserva já saiu CONFIRMADA debitando saldo de pacote (não precisa de Pix). */
  viaPacote?: boolean;
  /** saldo de horas restante no pacote, quando pago via pacote. */
  saldoApos?: number;
  /** crédito em R$ aplicado automaticamente nesta reserva (0/undefined se nenhum). */
  creditoAplicado?: number;
  /** valor que ainda falta pagar por Pix (0 = totalmente coberto por crédito/pacote). */
  diferenca?: number;
  /** true se usou crédito em R$ (total ou parcial). */
  viaCredito?: boolean;
  /** true se a reserva já está PAGA (pacote ou crédito cobriu tudo) — não pedir Pix. */
  jaPago?: boolean;
}

/**
 * Cria uma reserva PROVISÓRIA (hold) para o cliente da conversa — pendente de
 * pagamento via Pix. NÃO confirma pagamento nem debita pacote aqui: a confirmação é
 * automática quando o comprovante chega (processarComprovanteHigia). O `clienteId`
 * vem do servidor (nunca do LLM).
 */
export async function agendarReservaAgente(input: {
  clienteId: string;
  data: string;
  hora: string;
  duracaoMin: number;
  finalidade?: string;
  salaId?: string;
  /** Nome da sala que o cliente escolheu explicitamente (tem prioridade sobre precisaMesa). */
  salaNome?: string;
  valor?: number;
  precisaMesa?: boolean;
  /** Se informado, paga a reserva debitando esse pacote (sem Pix) — recorrente com saldo. */
  pacoteClienteId?: string;
}): Promise<AgendamentoOk | { erro: string }> {
  const { clienteId, data, hora, duracaoMin, finalidade, valor, pacoteClienteId } = input;
  const invalido = janelaSanitizada(data, hora, duracaoMin);
  if (invalido) return { erro: invalido };

  const { inicio, fim } = calcularJanela(data, hora, duracaoMin);
  if (inicio.getTime() <= Date.now()) return { erro: "Esse horário já passou — sugira uma data/hora futura." };

  // Cliente precisa existir e estar ativo.
  const [cli] = await db
    .select({
      id: clientes.id,
      bloqueado: clientes.bloqueado,
      status: clientes.status_lead,
      qualificado: clientes.perfil_qualificado_em,
      aceitou: clientes.aceitou_politica_em,
    })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return { erro: "Cliente não encontrado." };
  if (cli.bloqueado) return { erro: "Cliente bloqueado — encaminhe para a equipe." };

  // Onboarding obrigatório do cliente NOVO antes de reservar: qualificação de perfil
  // (maca/pessoas) + aceite da política. Recorrente (já é "cliente" ou tem reserva
  // confirmada/concluída) pula essas travas — ele já passou por isso antes.
  const [passada] = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(
      and(
        eq(reservas.cliente_id, clienteId),
        eq(reservas.is_deleted, false),
        inArray(reservas.status_reserva, ["confirmada", "concluida"])
      )
    )
    .limit(1);
  const recorrente = cli.status === "cliente" || Boolean(passada);
  if (!recorrente) {
    if (cli.status === "fora_perfil") {
      return { erro: "Cliente fora do perfil (maca/procedimento ou grupo acima de 3) — não agende; explique com gentileza." };
    }
    if (!cli.qualificado) {
      return {
        erro: "Antes de agendar para cliente novo, registre a qualificação com a ferramenta qualificar_cliente (tipo de uso, nº de pessoas e se precisa de maca/procedimento).",
      };
    }
    if (!cli.aceitou) {
      return {
        erro: "Antes de agendar, o cliente novo precisa preencher o formulário de cadastro e aceitar a política. Envie o link do formulário e, quando ele disser que preencheu, chame confirmar_cadastro (eu valido pela planilha). O aceite só vale pela planilha — não dá pra registrar só porque o cliente diz 'aceito' no chat.",
      };
    }
  }

  try {
    const reserva = await db.transaction(async (tx) => {
      // Serializa por cliente (mesmo padrão da ingestão): impede holds duplicados em
      // corrida — retry da fila pós-agendamento, inline concorrente ou 2 tool_use no turno.
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${clienteId}))`);

      // IDEMPOTÊNCIA: já existe reserva ATIVA do MESMO cliente para ESTA janela? Reaproveita.
      // (não filtra por status_pagamento: assim um retry de reserva paga por pacote
      // reaproveita a já criada em vez de debitar o saldo de novo.)
      const [existente] = await tx
        .select({
          id: reservas.id,
          sala_id: reservas.sala_id,
          pacote_cliente_id: reservas.pacote_cliente_id,
          status_pagamento: reservas.status_pagamento,
        })
        .from(reservas)
        .where(
          and(
            eq(reservas.cliente_id, clienteId),
            eq(reservas.is_deleted, false),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            eq(reservas.inicio_em, inicio),
            eq(reservas.fim_em, fim)
          )
        );
      if (existente) {
        const [s] = await tx.select({ nome: salas.nome }).from(salas).where(eq(salas.id, existente.sala_id));
        // Reflete como a reserva existente foi paga: se já é via pacote/crédito (paga), NÃO
        // pedir Pix de novo (retry/2ª chamada da mesma janela). saldoApos null = já debitado.
        return {
          id: existente.id,
          salaNome: s?.nome ?? "sala reservada",
          reaproveitado: true,
          viaPacote: existente.pacote_cliente_id != null,
          saldoApos: null as number | null,
          creditoAplicado: 0,
          diferenca: 0,
          viaCredito: false,
          jaPago: existente.status_pagamento === "pago",
        };
      }

      // Anti-flood (dentro do lock): só conta holds pendentes RECENTES (últimas 24h).
      // Holds antigos abandonados (ex.: de rodadas de teste anteriores) NÃO bloqueiam
      // um lote novo legítimo. Backstop contra loop, não contra uso normal.
      const corte24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const holds = await tx
        .select({ id: reservas.id })
        .from(reservas)
        .where(
          and(
            eq(reservas.cliente_id, clienteId),
            eq(reservas.is_deleted, false),
            eq(reservas.status_pagamento, "pendente"),
            notInArray(reservas.status_reserva, STATUS_LIVRES),
            gt(reservas.fim_em, new Date()),
            gt(reservas.created_at, corte24h)
          )
        );
      if (holds.length >= MAX_HOLDS_PENDENTES) {
        // Mensagem para o cliente continuar (NÃO encaminha para humano).
        throw new ReservaIndisponivel(
          "Você já tem várias reservas em aberto aguardando pagamento. Conclua o Pix das anteriores e eu sigo com as novas, tá?"
        );
      }

      // Salas ativas livres na janela (constraint GiST é o backstop final).
      const ativas = await tx
        .select({ id: salas.id, nome: salas.nome, prioridade: salas.prioridade_alocacao, tem_mesa: salas.tem_mesa })
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
      // Roteamento por mesa: quem precisa de mesa → sala com mesa; quem não precisa
      // (ex.: psicólogo) → sala sem mesa (Sala 02). Prioridade de alocação como desempate.
      const livres = ordenarSalasPorPreferencia(
        ativas.filter((s) => !ocupado.has(s.id)),
        input.precisaMesa
      );

      // Escolha da sala. Prioridade: id explícito > nome pedido pelo cliente > regra de mesa.
      // A escolha EXPLÍCITA do cliente (salaNome) vence o roteamento por mesa.
      let escolhida: (typeof livres)[number] | undefined;
      if (input.salaId) {
        escolhida = livres.find((s) => s.id === input.salaId);
        if (!escolhida) throw new ReservaIndisponivel("A sala pedida não está livre nesse horário.");
      } else if (input.salaNome) {
        const alvo = ativas.find((s) => casaSalaNome(s.nome, input.salaNome!));
        if (alvo) {
          escolhida = livres.find((s) => s.id === alvo.id);
          if (!escolhida) {
            throw new ReservaIndisponivel(`A ${alvo.nome} não está livre nesse horário. Posso ver outra sala pra você?`);
          }
        } else {
          escolhida = livres[0]; // nome não reconhecido → escolhe pela preferência de mesa
        }
      } else {
        escolhida = livres[0];
      }
      if (!escolhida) throw new ReservaIndisponivel("Nenhuma sala livre nesse horário.");

      // Pagamento por PACOTE (recorrente com saldo): debita ANTES de inserir, e a reserva
      // já nasce CONFIRMADA/paga (sem Pix). Senão, hold pendente de Pix (fluxo normal).
      let horasDebitadas: number | null = null;
      let saldoApos: number | null = null;
      if (pacoteClienteId) {
        const horas = Math.round((duracaoMin / 60) * 100) / 100;
        const r = await debitarPacoteEmTx(tx, { pacoteClienteId, clienteId, horas });
        horasDebitadas = horas;
        saldoApos = r.saldoApos;
      }

      // CRÉDITO em R$ (avulsa, sem pacote): aplica o saldo automaticamente. Cobre tudo →
      // reserva confirmada sem Pix; cobre em parte → Pix APENAS da diferença.
      let creditoAplicado = 0;
      let diferenca = valor != null && Number.isFinite(valor) ? round2(valor) : 0;
      if (!pacoteClienteId && valor != null && Number.isFinite(valor) && valor > 0) {
        const saldoCred = await saldoCreditoEmTx(tx, clienteId);
        if (saldoCred > 0) {
          creditoAplicado = round2(Math.min(saldoCred, valor));
          diferenca = round2(valor - creditoAplicado);
        }
      }
      const creditoCobre = creditoAplicado > 0 && diferenca <= 0;
      const confirmada = !!pacoteClienteId || creditoCobre;

      const [nova] = await tx
        .insert(reservas)
        .values({
          sala_id: escolhida.id,
          cliente_id: clienteId,
          pacote_cliente_id: pacoteClienteId ?? null,
          titulo: finalidade?.trim() || "Reserva via Hígia",
          data,
          hora,
          duracao_min: duracaoMin,
          inicio_em: inicio,
          fim_em: fim,
          tipo: "uso_sala",
          status_reserva: confirmada ? "confirmada" : "pendente",
          status_pagamento: confirmada ? "pago" : "pendente",
          origem: "higia",
          modalidade: "presencial",
          horas_debitadas: horasDebitadas != null ? String(horasDebitadas) : null,
        })
        .returning();

      if (pacoteClienteId && horasDebitadas != null && saldoApos != null) {
        // Movimento de débito de pacote (ledger) — após inserir a reserva (precisa do reserva_id).
        await registrarDebitoEmTx(tx, {
          pacoteClienteId,
          reservaId: nova.id,
          horas: horasDebitadas,
          saldoApos,
        });
      } else {
        // Avulsa: debita o crédito em R$ aplicado (se houver) e cobra por Pix APENAS a diferença.
        if (creditoAplicado > 0) {
          await debitarCreditoEmTx(tx, {
            clienteId,
            valor: creditoAplicado,
            reservaId: nova.id,
            motivo: `Crédito aplicado na reserva ${data} ${hora}`,
          });
        }
        if (diferenca > 0) {
          // Pagamento pendente (Pix manual) do que falta — o comprovante é validado contra ele.
          await tx.insert(pagamentos).values({
            cliente_id: clienteId,
            reserva_id: nova.id,
            valor: String(diferenca),
            status: "pendente",
            provedor: "pix_manual",
          });
        }
        // diferenca <= 0 com creditoAplicado > 0 → totalmente paga por crédito (sem Pix).
      }

      return {
        id: nova.id,
        salaNome: escolhida.nome,
        reaproveitado: false,
        viaPacote: !!pacoteClienteId,
        saldoApos,
        creditoAplicado,
        diferenca,
        viaCredito: creditoAplicado > 0,
        jaPago: confirmada,
      };
    });

    // Auditoria + Google só para reserva NOVA (reaproveitada já foi registrada/sincronizada).
    if (!reserva.reaproveitado) {
      const detPagamento = reserva.viaPacote
        ? `PAGO via pacote (saldo restante: ${reserva.saldoApos}h)`
        : reserva.creditoAplicado && reserva.creditoAplicado > 0
          ? reserva.jaPago
            ? `PAGO via crédito (R$ ${reserva.creditoAplicado.toFixed(2)})`
            : `crédito R$ ${reserva.creditoAplicado.toFixed(2)} aplicado + Pix da diferença R$ ${reserva.diferenca?.toFixed(2)}`
          : "pendente de Pix";
      await registrarAuditoria({
        acao: "criar",
        entidade: "reservas",
        registroId: reserva.id,
        detalhes: `Hígia agendou ${data} ${hora} (${duracaoMin}min) em ${reserva.salaNome} — ${detPagamento}`,
      }).catch(() => undefined);
      // Reserva paga (pacote/crédito) já é "confirmada" → entra no Google na hora.
      await sincronizarReserva(reserva.id).catch(() => undefined);
    }

    return {
      ok: true,
      reservaId: reserva.id,
      salaNome: reserva.salaNome,
      data,
      hora,
      duracaoMin,
      viaPacote: reserva.viaPacote,
      saldoApos: reserva.saldoApos ?? undefined,
      creditoAplicado: reserva.creditoAplicado || undefined,
      diferenca: reserva.diferenca,
      viaCredito: reserva.viaCredito,
      jaPago: reserva.jaPago,
    };
  } catch (e: unknown) {
    if (e instanceof SaldoError) return { erro: e.message };
    if (e instanceof ReservaIndisponivel) return { erro: e.message };
    if (typeof e === "object" && e !== null && "code" in e && (e as { code: string }).code === "23P01") {
      return { erro: "Horário acabou de ser ocupado — ofereça outro horário." };
    }
    return { erro: "Não consegui registrar esse horário agora — tente novamente em instantes." };
  }
}

class ReservaIndisponivel extends Error {}
