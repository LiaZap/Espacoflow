import { Queue } from "bullmq";
import { getConexaoBull } from "./conexao";

export const FILA_RESPONDER_HIGIA = "responder-higia";

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
