import { Queue } from "bullmq";
import { getConexaoBull } from "./conexao";

export const FILA_RESPONDER_HIGIA = "responder-higia";
export const FILA_LEMBRETE_ACESSO = "lembrete-acesso";
export const FILA_EXPIRAR_HOLDS = "expirar-holds";

let fila: Queue | null = null;

/** Fila de respostas da Hígia: retry com backoff exponencial; falhas vão p/ DLQ. */
export function getFilaHigia(): Queue {
  if (!fila) {
    fila = new Queue(FILA_RESPONDER_HIGIA, {
      connection: getConexaoBull(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 3000 },
        removeOnComplete: 500,
        removeOnFail: false, // mantém falhas para inspeção / DLQ
      },
    });
  }
  return fila;
}

let filaLembrete: Queue | null = null;

/** Fila do lembrete de acesso (~1 dia antes) — alimentada por um job repetível diário. */
export function getFilaLembrete(): Queue {
  if (!filaLembrete) {
    filaLembrete = new Queue(FILA_LEMBRETE_ACESSO, {
      connection: getConexaoBull(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 60_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return filaLembrete;
}

/**
 * Registra (idempotente) o job repetível diário do lembrete de acesso: todo dia às 18h
 * (America/Sao_Paulo) varre as reservas CONFIRMADAS de AMANHÃ e envia as instruções.
 * Reexecuções com o mesmo padrão são deduplicadas pelo BullMQ.
 */
export async function registrarLembreteDiario(): Promise<void> {
  await getFilaLembrete().add(
    "varrer-amanha",
    {},
    { repeat: { pattern: "0 18 * * *", tz: "America/Sao_Paulo" }, removeOnComplete: true }
  );
}

let filaExpirar: Queue | null = null;

/** Fila que libera holds abandonados — alimentada por um job repetível a cada 15 min. */
export function getFilaExpirar(): Queue {
  if (!filaExpirar) {
    filaExpirar = new Queue(FILA_EXPIRAR_HOLDS, {
      connection: getConexaoBull(),
      defaultJobOptions: {
        attempts: 2,
        backoff: { type: "exponential", delay: 30_000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      },
    });
  }
  return filaExpirar;
}

/**
 * Registra (idempotente) o job repetível que solta holds abandonados a cada 15 minutos.
 * Libera salas presas por pré-reservas sem pagamento (deduplicado pelo BullMQ).
 */
export async function registrarExpiracaoHolds(): Promise<void> {
  await getFilaExpirar().add(
    "expirar",
    {},
    { repeat: { pattern: "*/15 * * * *", tz: "America/Sao_Paulo" }, removeOnComplete: true }
  );
}
