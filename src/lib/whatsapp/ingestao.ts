import { and, eq, sql } from "drizzle-orm";
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
  /** true = enviada PELO número conectado (humano no celular ou nosso próprio envio). */
  fromMe?: boolean;
}

type PayloadQualquer = Record<string, unknown> & {
  data?: Record<string, unknown>;
};

/** Normaliza o payload do webhook do Evolution API (evento messages.upsert). */
export function normalizarEvolution(payload: PayloadQualquer): MensagemNormalizada | null {
  const data = (payload?.data ?? payload) as Record<string, unknown>;
  const key = data?.key as { remoteJid?: string; id?: string; fromMe?: boolean } | undefined;
  if (!key) return null;
  // remoteJid é sempre a OUTRA ponta (o cliente), mesmo quando fromMe=true.
  const telefone = String(key.remoteJid ?? "").replace(/@.*/, "").replace(/\D/g, "");
  if (!telefone) return null; // descarta status@broadcast e afins (vira string vazia)

  const fromMe = !!key.fromMe;
  // pushName em fromMe é o nome de QUEM enviou (o número do espaço), não o cliente.
  const nome = !fromMe && data?.pushName ? String(data.pushName) : undefined;
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

  return { telefone, nome, texto, tipo, midiaUrl, idExterno: key.id, payload, fromMe };
}

export type ResultadoIngestao =
  | { duplicada: true }
  | { duplicada: false; conversa: WhatsappConversa };

/** Sentinela interna para abortar a transação quando a mensagem é duplicada. */
class MensagemDuplicada extends Error {}

/**
 * Persiste uma mensagem recebida: dedupe de cliente por telefone, conversa aberta
 * por cliente, e a mensagem com payload bruto. Idempotente por idExterno.
 *
 * A idempotência é ATÔMICA: cliente, conversa e mensagem entram numa única
 * transação e a inserção da mensagem usa o índice único `uq_mensagens_externo`
 * com ON CONFLICT DO NOTHING. Se o webhook reentregar a mesma mensagem (mesmo
 * id_externo), o INSERT não grava nada e a transação inteira é revertida — sem
 * incrementar não-lidas nem disparar a Hígia em duplicidade.
 */
export async function ingerirMensagemRecebida(m: MensagemNormalizada): Promise<ResultadoIngestao> {
  // Re-hospeda a mídia no MinIO FORA da transação (chamada de rede); senão mantém a URL original.
  let midiaFinal = m.midiaUrl ?? null;
  if (m.midiaUrl) {
    const persistida = await persistirMidia(m.midiaUrl, m.tipo);
    if (persistida) midiaFinal = persistida;
  }

  let conv: WhatsappConversa;
  try {
    conv = await db.transaction(async (tx) => {
      // Serializa por telefone: evita corrida (2 entregas simultâneas) criando
      // cliente/conversa em duplicidade ou violando o UNIQUE(telefone).
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${m.telefone}))`);

      // cliente por telefone (telefone é UNIQUE; busca inclui soft-deletado para
      // não violar a constraint — uma mensagem nova reativa um lead excluído).
      let [cli] = await tx.select().from(clientes).where(eq(clientes.telefone, m.telefone));
      if (!cli) {
        [cli] = await tx
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
        await tx
          .update(clientes)
          .set({ ultima_atividade: new Date(), is_deleted: false, deleted_at: null })
          .where(eq(clientes.id, cli.id));
      }

      // conversa aberta (uma por cliente) — cria com nao_lidas 0; ajusta abaixo.
      let [c] = await tx
        .select()
        .from(whatsappConversas)
        .where(and(eq(whatsappConversas.cliente_id, cli.id), eq(whatsappConversas.is_deleted, false)));
      if (!c) {
        [c] = await tx
          .insert(whatsappConversas)
          .values({ cliente_id: cli.id, status: "higia", ultima_mensagem_em: new Date(), nao_lidas: 0 })
          .returning();
      }

      // Mensagem com guarda atômica de duplicidade (índice único uq_mensagens_externo).
      // fromMe = enviada pelo número do espaço (humano no celular OU eco do nosso envio).
      const inseridas = await tx
        .insert(whatsappMensagens)
        .values({
          conversa_id: c.id,
          origem: m.fromMe ? "humano" : "user",
          tipo: m.tipo,
          conteudo: m.texto ?? null,
          midia_url: midiaFinal,
          midia_tipo: m.tipo !== "text" ? m.tipo : null,
          status: m.fromMe ? "sent" : "delivered",
          enviada_em: new Date(),
          id_externo: m.idExterno ?? null,
          payload_bruto: m.payload,
        })
        .onConflictDoNothing({ target: whatsappMensagens.id_externo })
        .returning({ id: whatsappMensagens.id });

      // Conflito (mesma id_externo já existe — ex.: eco do que NÓS enviamos) → reverte
      // tudo e sinaliza duplicada. Assim o nosso próprio envio não vira "novo humano".
      if (m.idExterno && inseridas.length === 0) throw new MensagemDuplicada();

      if (m.fromMe) {
        // Humano respondeu (pelo celular ou painel) → assume a conversa: Hígia pausa.
        await tx
          .update(whatsappConversas)
          .set({ status: "humano", ultima_mensagem_em: new Date(), updated_at: new Date() })
          .where(eq(whatsappConversas.id, c.id));
      } else {
        await tx
          .update(whatsappConversas)
          .set({ ultima_mensagem_em: new Date(), nao_lidas: c.nao_lidas + 1 })
          .where(eq(whatsappConversas.id, c.id));
      }
      return c;
    });
  } catch (e) {
    if (e instanceof MensagemDuplicada) return { duplicada: true };
    throw e;
  }

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
