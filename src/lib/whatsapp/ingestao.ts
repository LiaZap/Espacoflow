import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";
import {
  whatsappConversas,
  whatsappMensagens,
  type WhatsappConversa,
} from "@/lib/db/schema/whatsapp";
import { salvarPayloadBruto } from "@/lib/mongo/client";
import { persistirMidia } from "@/lib/storage/midia";

export interface MensagemNormalizada {
  telefone: string;
  nome?: string;
  texto?: string;
  tipo: string;
  idExterno?: string;
  midiaUrl?: string;
  payload: unknown;
}

type PayloadQualquer = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

/** Normaliza o payload do webhook do Evolution API (evento messages.upsert). */
export function normalizarEvolution(payload: PayloadQualquer): MensagemNormalizada | null {
  const data = (payload?.data ?? payload) as Record<string, unknown>;
  const key = data?.key as { remoteJid?: string; id?: string; fromMe?: boolean } | undefined;
  if (!key || key.fromMe) return null; // ignora o que nós mesmos enviamos
  const telefone = String(key.remoteJid ?? "").replace(/@.*/, "").replace(/\D/g, "");
  if (!telefone) return null;

  const nome = data?.pushName ? String(data.pushName) : undefined;
  const msg = (data?.message ?? {}) as Record<string, any>;
  let texto: string | undefined;
  let tipo = "text";
  let midiaUrl: string | undefined;

  if (typeof msg.conversation === "string") texto = msg.conversation;
  else if (msg.extendedTextMessage?.text) texto = String(msg.extendedTextMessage.text);
  else if (msg.imageMessage) {
    tipo = "image";
    texto = msg.imageMessage.caption ? String(msg.imageMessage.caption) : undefined;
    midiaUrl = msg.imageMessage.url ?? msg.imageMessage.mediaUrl;
  } else if (msg.audioMessage) {
    tipo = "audio";
    midiaUrl = msg.audioMessage.url ?? msg.audioMessage.mediaUrl;
  } else if (msg.documentMessage) {
    tipo = "document";
    texto = msg.documentMessage.fileName ? String(msg.documentMessage.fileName) : undefined;
    midiaUrl = msg.documentMessage.url ?? msg.documentMessage.mediaUrl;
  } else if (msg.videoMessage) {
    tipo = "video";
    texto = msg.videoMessage.caption ? String(msg.videoMessage.caption) : undefined;
    midiaUrl = msg.videoMessage.url ?? msg.videoMessage.mediaUrl;
  }

  return { telefone, nome, texto, tipo, midiaUrl, idExterno: key.id, payload };
}

export type ResultadoIngestao =
  | { duplicada: true }
  | { duplicada: false; conversa: WhatsappConversa };

/**
 * Persiste uma mensagem recebida: dedupe de cliente por telefone, conversa aberta
 * por cliente, e a mensagem com payload bruto. Idempotente por idExterno.
 */
export async function ingerirMensagemRecebida(m: MensagemNormalizada): Promise<ResultadoIngestao> {
  if (m.idExterno) {
    const [existe] = await db
      .select({ id: whatsappMensagens.id })
      .from(whatsappMensagens)
      .where(eq(whatsappMensagens.id_externo, m.idExterno));
    if (existe) return { duplicada: true };
  }

  // cliente (dedupe por telefone)
  let [cli] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.telefone, m.telefone), eq(clientes.is_deleted, false)));
  if (!cli) {
    [cli] = await db
      .insert(clientes)
      .values({
        nome: m.nome ?? m.telefone,
        telefone: m.telefone,
        origem: "whatsapp",
        status_lead: "novo",
        ultima_atividade: new Date(),
      })
      .returning();
  } else {
    await db.update(clientes).set({ ultima_atividade: new Date() }).where(eq(clientes.id, cli.id));
  }

  // conversa aberta (uma por cliente)
  let [conv] = await db
    .select()
    .from(whatsappConversas)
    .where(and(eq(whatsappConversas.cliente_id, cli.id), eq(whatsappConversas.is_deleted, false)));
  if (!conv) {
    [conv] = await db
      .insert(whatsappConversas)
      .values({ cliente_id: cli.id, status: "higia", ultima_mensagem_em: new Date(), nao_lidas: 1 })
      .returning();
  } else {
    await db
      .update(whatsappConversas)
      .set({ ultima_mensagem_em: new Date(), nao_lidas: conv.nao_lidas + 1 })
      .where(eq(whatsappConversas.id, conv.id));
  }

  // Re-hospeda a mídia no MinIO (se houver e estiver acessível); senão mantém a URL original.
  let midiaFinal = m.midiaUrl ?? null;
  if (m.midiaUrl) {
    const persistida = await persistirMidia(m.midiaUrl, m.tipo);
    if (persistida) midiaFinal = persistida;
  }

  await db.insert(whatsappMensagens).values({
    conversa_id: conv.id,
    origem: "user",
    tipo: m.tipo,
    conteudo: m.texto ?? null,
    midia_url: midiaFinal,
    midia_tipo: m.tipo !== "text" ? m.tipo : null,
    status: "delivered",
    enviada_em: new Date(),
    id_externo: m.idExterno ?? null,
    payload_bruto: m.payload,
  });

  // Arquiva o payload bruto também no Mongo (NoSQL flexível p/ a IA).
  await salvarPayloadBruto({
    telefone: m.telefone,
    tipo: m.tipo,
    conversaId: conv.id,
    idExterno: m.idExterno ?? null,
    payload: m.payload,
  });

  return { duplicada: false, conversa: conv };
}
