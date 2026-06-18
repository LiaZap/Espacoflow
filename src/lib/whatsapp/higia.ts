import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappConversas, whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { agenteConfig } from "@/lib/db/schema/agente";
import { clientes } from "@/lib/db/schema/clientes";
import { montarPromptHigia } from "@/lib/agente/montar-prompt";
import { registrarIaLog, lembrarMemoria } from "@/lib/mongo/client";
import { getProvider } from "./provider";
import { enviarHumanizado, limparTextoHigia } from "./humanizar";

export interface ResultadoHigia {
  enviada: boolean;
  motivo?: string;
}

/**
 * Gera e envia a resposta da Hígia para uma conversa, se ela estiver no controle
 * da IA e houver ANTHROPIC_API_KEY. Sem chave, deixa para atendimento humano.
 */
export async function gerarRespostaHigia(conversaId: string): Promise<ResultadoHigia> {
  const inicio = Date.now();

  const [conv] = await db
    .select()
    .from(whatsappConversas)
    .where(and(eq(whatsappConversas.id, conversaId), eq(whatsappConversas.is_deleted, false)));
  if (!conv) return { enviada: false, motivo: "conversa não encontrada" };
  if (conv.status !== "higia") return { enviada: false, motivo: "conversa sob atendimento humano" };

  const [cfg] = await db
    .select()
    .from(agenteConfig)
    .where(eq(agenteConfig.is_deleted, false))
    .limit(1);
  if (!cfg?.ativo || !cfg?.resposta_automatica) {
    return { enviada: false, motivo: "resposta automática desativada" };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { enviada: false, motivo: "sem ANTHROPIC_API_KEY (deixado para humano)" };

  const [cli] = await db.select().from(clientes).where(eq(clientes.id, conv.cliente_id));
  const historico = await db
    .select()
    .from(whatsappMensagens)
    .where(and(eq(whatsappMensagens.conversa_id, conversaId), eq(whatsappMensagens.is_deleted, false)))
    .orderBy(asc(whatsappMensagens.created_at));

  const mensagens = historico
    .filter((h) => h.conteudo)
    .map((h) => ({
      role: h.origem === "user" ? ("user" as const) : ("assistant" as const),
      content: h.conteudo as string,
    }));
  if (mensagens.length === 0) return { enviada: false, motivo: "sem conteúdo" };

  const system = await montarPromptHigia({ clienteId: conv.cliente_id });
  let texto = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: cfg.modelo_ia || "claude-haiku-4-5",
        max_tokens: 700,
        system,
        messages: mensagens,
      }),
    });
    if (!res.ok) return { enviada: false, motivo: `LLM HTTP ${res.status}` };
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    texto = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")
      .trim();
  } catch (e) {
    return { enviada: false, motivo: String(e) };
  }
  if (!texto) return { enviada: false, motivo: "resposta vazia" };
  texto = limparTextoHigia(texto);

  // Envio HUMANIZADO: "digitando…", mensagens picadas e delays. Cada bloco vira
  // uma mensagem no thread (como um humano que escreve em rajadas).
  const provider = getProvider();
  const resultado = await enviarHumanizado(provider, cli?.telefone ?? "", texto, {
    onBloco: async (bloco, idExterno, ok) => {
      await db.insert(whatsappMensagens).values({
        conversa_id: conversaId,
        origem: "higia",
        tipo: "text",
        conteudo: bloco,
        status: ok ? "sent" : "failed",
        processada_por_higia: true,
        tempo_resposta_ms: Date.now() - inicio,
        enviada_em: new Date(),
        id_externo: idExterno ?? null,
      });
    },
  });

  await db
    .update(whatsappConversas)
    .set({ ultima_mensagem_em: new Date() })
    .where(eq(whatsappConversas.id, conversaId));

  await registrarIaLog({
    conversaId,
    clienteId: conv.cliente_id,
    modelo: cfg.modelo_ia,
    blocos: resultado.blocos,
    latenciaMs: Date.now() - inicio,
    resposta: texto,
  }).catch(() => undefined);

  // Memória do agente: lembra o perfil + última interação deste cliente.
  await lembrarMemoria(conv.cliente_id, {
    nome: cli?.nome ?? null,
    telefone: cli?.telefone ?? null,
    status_lead: cli?.status_lead ?? null,
    ultima_interacao: new Date().toISOString(),
    ultima_resposta: texto.slice(0, 500),
  }).catch(() => undefined);

  return { enviada: resultado.algumOk, motivo: resultado.algumOk ? undefined : "falha no envio" };
}
