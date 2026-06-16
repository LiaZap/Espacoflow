import type { ConnectionOptions } from "bullmq";

/**
 * Opções de conexão para o BullMQ (ele cria o próprio cliente ioredis embarcado,
 * evitando conflito de versões). maxRetriesPerRequest: null é exigido pelo BullMQ.
 */
export function getConexaoBull(): ConnectionOptions {
  const url = new URL(process.env.REDIS_URL ?? "redis://localhost:6379");
  return {
    host: url.hostname,
    port: Number(url.port || 6379),
    password: url.password || undefined,
    maxRetriesPerRequest: null,
  };
}

/** A fila só é usada quando explicitamente habilitada (senão, processamento inline). */
export function filaHabilitada(): boolean {
  return process.env.FILA_HABILITADA === "true";
}
