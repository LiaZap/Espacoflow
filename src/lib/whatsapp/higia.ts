import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { whatsappConversas, whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { agenteConfig } from "@/lib/db/schema/agente";
import { clientes } from "@/lib/db/schema/clientes";
import { montarPromptHigia } from "@/lib/agente/montar-prompt";
import { registrarIaLog, lembrarMemoria } from "@/lib/mongo/client";
import { registrarAuditoria } from "@/lib/audit/logger";
import { getProvider } from "./provider";
import { enviarHumanizado, limparTextoHigia } from "./humanizar";
import { extrairMarcadores, resolverMidia, urlMidiaAbsoluta, tipoWhatsapp } from "./midia-marcadores";
import { extrairPix, montarMensagensPix } from "./pix";

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

  // GUARDRAIL: a Hígia escala com [HUMANO] e NUNCA confirma pagamento/reserva.
  let escalar = /\[\s*HUMANO\s*\]/iu.test(texto);
  texto = texto.replace(/\[\s*HUMANO\s*\]/giu, "").trim();
  let violou = false;
  const RE_CONFIRMA =
    /(pagamento|pix)\s+(foi\s+|est[áa]\s+)?(confirmad[oa]|aprovad[oa]|recebid[oa])|reserva\s+(foi\s+|est[áa]\s+)?(confirmad[oa]|garantid[oa])|est[áa]\s+(tudo\s+)?(pag[oa]|confirmad[oa])|confirmei\s+(o\s+|a\s+|seu\s+|sua\s+)?(pagamento|pix|reserva)/iu;
  if (RE_CONFIRMA.test(texto)) {
    violou = true;
    escalar = true;
    texto = "Boa! Deixa eu confirmar isso com a equipe pra te passar com segurança. Já te retorno por aqui 🙏";
  }

  // A Hígia pode pedir fotos ([FOTO: id]) e o Pix ([PIX]). Separa os marcadores:
  // manda o texto LIMPO e depois envia Pix (texto) e fotos.
  const marc = extrairMarcadores(texto);
  const pix = extrairPix(marc.texto);
  const textoLimpo = pix.texto;
  const tokens = marc.tokens;

  const provider = getProvider();
  const telefone = cli?.telefone ?? "";
  let algumOk = false;
  let blocosTexto = 0;
  let blocosMidia = 0;

  // Texto HUMANIZADO: "digitando…", mensagens picadas e delays.
  if (textoLimpo) {
    const r = await enviarHumanizado(provider, telefone, textoLimpo, {
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
    blocosTexto = r.blocos;
    algumOk = algumOk || r.algumOk;
  }

  // Pix (texto) pedido pela Hígia via [PIX] — chave exata vem da config.
  if (pix.temPix) {
    for (const msg of montarMensagensPix(cfg)) {
      await provider.definirPresenca(telefone, "composing").catch(() => undefined);
      const envio = await provider.enviarTexto(telefone, msg);
      algumOk = algumOk || envio.ok;
      blocosTexto += 1;
      await db.insert(whatsappMensagens).values({
        conversa_id: conversaId,
        origem: "higia",
        tipo: "text",
        conteudo: msg,
        status: envio.ok ? "sent" : "failed",
        processada_por_higia: true,
        enviada_em: new Date(),
        id_externo: envio.idExterno ?? null,
      });
    }
  }

  // Fotos/arquivos pedidos pela Hígia (resolvidos na biblioteca agente_midia).
  for (const token of tokens) {
    const m = await resolverMidia(token);
    if (!m) continue;
    const tipo = tipoWhatsapp(m.tipo_arquivo);
    const url = urlMidiaAbsoluta(m.arquivo_url);
    const legenda = m.descricao || m.nome;
    await provider.definirPresenca(telefone, "composing").catch(() => undefined);
    const envio = await provider.enviarMidia(telefone, {
      tipo,
      url,
      legenda,
      nomeArquivo: m.nome_arquivo ?? undefined,
    });
    algumOk = algumOk || envio.ok;
    blocosMidia += 1;
    await db.insert(whatsappMensagens).values({
      conversa_id: conversaId,
      origem: "higia",
      tipo,
      conteudo: legenda,
      midia_url: url,
      midia_tipo: m.tipo_arquivo,
      status: envio.ok ? "sent" : "failed",
      processada_por_higia: true,
      enviada_em: new Date(),
      id_externo: envio.idExterno ?? null,
    });
  }

  await db
    .update(whatsappConversas)
    .set({ ultima_mensagem_em: new Date(), ...(escalar ? { status: "humano" } : {}) })
    .where(eq(whatsappConversas.id, conversaId));

  if (escalar) {
    await registrarAuditoria({
      acao: "atualizar",
      entidade: "whatsapp_conversas",
      registroId: conversaId,
      severidade: violou ? "warn" : "info",
      detalhes: violou
        ? "Guardrail: a Hígia tentou confirmar pagamento/reserva — conversa escalada para humano."
        : "A Hígia escalou a conversa para a equipe ([HUMANO]).",
    }).catch(() => undefined);
  }

  await registrarIaLog({
    conversaId,
    clienteId: conv.cliente_id,
    modelo: cfg.modelo_ia,
    blocos: blocosTexto + blocosMidia,
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

  return { enviada: algumOk, motivo: algumOk ? undefined : "falha no envio" };
}
