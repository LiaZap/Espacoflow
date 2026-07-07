import "dotenv/config";
import { Worker, type Job } from "bullmq";
import { eq } from "drizzle-orm";
import { getConexaoBull } from "./conexao";
import { FILA_RESPONDER_HIGIA, FILA_LEMBRETE_ACESSO, registrarLembreteDiario } from "./filas";
import { gerarRespostaHigia } from "@/lib/whatsapp/higia";
import { enviarLembretesDoDiaSeguinte } from "@/lib/whatsapp/lembrete-acesso";
import { db } from "@/lib/db";
import { jobsFila } from "@/lib/db/schema/jobs";
import { APP_VERSION } from "@/lib/version";

// Motivos de "não enviada" que NÃO são erro (não devem disparar retry/DLQ).
const NAO_ERRO =
  /humano|desativada|conversa sob|sem conteúdo|não encontrada|vazia|key|respondida|definitivo|escalado|nada a enviar/i;

async function marcar(chave: string | undefined, status: string, tentativas: number, erro?: string) {
  if (!chave) return;
  await db
    .update(jobsFila)
    .set({
      status,
      tentativas,
      processado_em: status === "concluido" || status === "dlq" ? new Date() : null,
      erro: erro ?? null,
      updated_at: new Date(),
    })
    .where(eq(jobsFila.idempotency_key, chave));
}

const worker = new Worker(
  FILA_RESPONDER_HIGIA,
  async (job: Job) => {
    const { conversaId, chave } = job.data as { conversaId: string; chave: string };
    await marcar(chave, "processando", job.attemptsMade);
    const r = await gerarRespostaHigia(conversaId);
    if (!r.enviada && r.motivo && !NAO_ERRO.test(r.motivo)) {
      throw new Error(r.motivo); // dispara retry com backoff
    }
    await marcar(chave, "concluido", job.attemptsMade);
  },
  { connection: getConexaoBull(), concurrency: 1 } // concurrency 1 = ordem FIFO
);

worker.on("failed", async (job, err) => {
  if (!job) return;
  const tentativas = job.attemptsMade;
  const final = tentativas >= (job.opts.attempts ?? 1);
  const chave = (job.data as { chave?: string })?.chave;
  await marcar(chave, final ? "dlq" : "falhou", tentativas, err?.message);
});

worker.on("ready", () =>
  console.log(
    `[worker] versão ${APP_VERSION} — fila "${FILA_RESPONDER_HIGIA}" pronta (FIFO, concurrency=1)`
  )
);

// Worker do LEMBRETE de acesso (~1 dia antes): o job repetível diário dispara a varredura.
const workerLembrete = new Worker(
  FILA_LEMBRETE_ACESSO,
  async () => {
    const r = await enviarLembretesDoDiaSeguinte();
    console.log(`[worker] lembretes de acesso (amanhã): ${r.enviados}/${r.total} enviados`);
  },
  { connection: getConexaoBull(), concurrency: 1 }
);
workerLembrete.on("failed", (_job, err) => console.error(`[worker] lembrete de acesso falhou: ${err?.message}`));
workerLembrete.on("ready", () => console.log(`[worker] fila "${FILA_LEMBRETE_ACESSO}" pronta (lembrete diário 18h SP)`));

// Registra (idempotente) o job repetível diário. Roda a cada boot do worker.
registrarLembreteDiario().catch((e) => console.error("[worker] falha ao registrar lembrete diário:", e));

async function encerrar() {
  await worker.close();
  await workerLembrete.close();
  process.exit(0);
}
process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
