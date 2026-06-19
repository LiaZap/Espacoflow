import { db } from "@/lib/db";
import { jobsFila } from "@/lib/db/schema/jobs";
import { gerarRespostaHigia } from "@/lib/whatsapp/higia";
import { filaHabilitada } from "./conexao";
import { getFilaHigia, FILA_RESPONDER_HIGIA } from "./filas";

/**
 * Despacha a geração de resposta da Hígia.
 * - Fila desabilitada (dev): processa inline (fire-and-forget).
 * - Fila habilitada: registra na trilha jobs_fila e enfileira (FIFO via worker).
 *   A `chave` (idempotência) deve ser estável por mensagem (ex.: higia:<id_externo>).
 */
export async function despacharRespostaHigia(conversaId: string, chave?: string): Promise<void> {
  if (!filaHabilitada()) {
    void gerarRespostaHigia(conversaId).catch((e) => console.error("[higia inline]", e));
    return;
  }

  // BullMQ não aceita ":" no jobId (separador interno) → use "-".
  const idempotency = chave ?? `higia-${conversaId}`;
  await db
    .insert(jobsFila)
    .values({
      tipo: FILA_RESPONDER_HIGIA,
      entidade: "whatsapp_conversas",
      entidade_id: conversaId,
      status: "pendente",
      idempotency_key: idempotency,
    })
    .onConflictDoNothing();

  try {
    await getFilaHigia().add("responder", { conversaId, chave: idempotency }, { jobId: idempotency });
  } catch (e) {
    // Redis indisponível: não devolve 500 ao provedor (evita reentrega em loop).
    // Degrada para processamento inline — a Hígia ainda responde.
    console.error("[higia] fila indisponível, processando inline:", e);
    void gerarRespostaHigia(conversaId).catch((err) => console.error("[higia inline]", err));
  }
}
