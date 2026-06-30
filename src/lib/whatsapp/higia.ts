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
import { FERRAMENTAS_AGENDA, executarFerramentaAgenda } from "@/lib/agente/ferramentas";
import { processarComprovanteHigia } from "./comprovante-higia";

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

  // Coalescing anti-"double-texting": se a última mensagem da conversa já NÃO é
  // do cliente (a Hígia ou um humano já respondeu depois), não há nada novo a
  // responder. Em rajada (oi / tudo bem / quero reservar), só o job que vê a
  // última mensagem ainda sem resposta gera UMA resposta sobre todo o histórico.
  const ultima = historico[historico.length - 1];
  if (ultima && ultima.origem !== "user") {
    return { enviada: false, motivo: "conversa já respondida (sem mensagem nova)" };
  }

  // Comprovante de Pix: se o cliente mandou uma imagem e há reserva aguardando
  // pagamento, a Hígia LÊ e valida em código — confirma sozinha só se bater 100%
  // (Pix, valor exato, favorecido = conta do espaço, recente, não reutilizado);
  // qualquer divergência escala para a equipe. Não passa pelo LLM.
  if (cfg.reserva_via_ia && ultima?.tipo === "image" && ultima.midia_url && cli?.telefone) {
    const r = await processarComprovanteHigia({
      conversaId,
      clienteId: conv.cliente_id,
      telefone: cli.telefone,
      midiaUrl: ultima.midia_url,
    });
    if (r.tratou) return { enviada: true, motivo: r.confirmada ? "pagamento confirmado (IA)" : "comprovante escalado" };
  }

  const mensagens = historico
    .map((h) => {
      const txt = (h.conteudo ?? "").trim();
      // Mídia (imagem/áudio/arquivo) costuma vir SEM texto. Sem um placeholder ela
      // seria descartada e a Hígia ficaria muda — ex.: cliente manda comprovante sem
      // ter um pagamento pendente (não cai no fluxo de comprovante). Dá um texto mínimo
      // para o modelo poder responder.
      const content = txt || (h.tipo !== "text" ? "[o cliente enviou uma imagem/arquivo]" : "");
      return {
        role: h.origem === "user" ? ("user" as const) : ("assistant" as const),
        content,
      };
    })
    .filter((m) => m.content);
  if (mensagens.length === 0) return { enviada: false, motivo: "sem conteúdo" };

  // A API da Anthropic exige papéis ALTERNADOS começando em 'user'. No WhatsApp o
  // cliente manda várias mensagens seguidas → vários 'user' consecutivos → HTTP 400.
  // Colapsa mensagens consecutivas do mesmo papel e descarta 'assistant' iniciais.
  const mensagensApi: Array<{ role: "user" | "assistant"; content: string }> = [];
  for (const m of mensagens) {
    if (mensagensApi.length === 0 && m.role !== "user") continue;
    const anterior = mensagensApi[mensagensApi.length - 1];
    if (anterior && anterior.role === m.role) anterior.content += "\n" + m.content;
    else mensagensApi.push({ role: m.role, content: m.content });
  }
  if (mensagensApi.length === 0) return { enviada: false, motivo: "sem conteúdo" };

  // Agendamento autônomo: a Hígia ganha ferramentas (consultar disponibilidade /
  // agendar) quando "reserva via IA" está ligada. O clienteId é fixado AQUI no
  // servidor (a partir da conversa) — nunca vem do modelo.
  const agendamento = !!cfg.reserva_via_ia;
  const system = await montarPromptHigia({ clienteId: conv.cliente_id, agendamento });

  type Bloco = { type: string; text?: string; id?: string; name?: string; input?: Record<string, unknown> };
  const msgs: Array<{ role: "user" | "assistant"; content: unknown }> = [...mensagensApi];
  let texto = "";
  try {
    // Loop de tool use: enquanto o modelo pedir ferramenta, executamos e devolvemos
    // o resultado. Guard de 6 iterações evita loop infinito.
    for (let i = 0; i < 6; i++) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          // Com ferramentas, a mesma resposta pode ter tool_use (JSON) + texto → mais folga.
          model: cfg.modelo_ia || "claude-haiku-4-5",
          max_tokens: agendamento ? 1500 : 800,
          system,
          messages: msgs,
          ...(agendamento ? { tools: FERRAMENTAS_AGENDA } : {}),
        }),
      });
      // 4xx é erro de requisição (não adianta retry → não vai para a DLQ). 5xx/429 retenta.
      if (!res.ok) {
        const retentavel = res.status >= 500 || res.status === 429;
        return { enviada: false, motivo: `LLM HTTP ${res.status}${retentavel ? "" : " (definitivo)"}` };
      }
      const data = (await res.json()) as { content?: Bloco[]; stop_reason?: string };
      const blocos = data.content ?? [];
      const chamadas = blocos.filter((b) => b.type === "tool_use");

      if (data.stop_reason === "tool_use" && chamadas.length > 0) {
        msgs.push({ role: "assistant", content: blocos });
        const resultados = [];
        for (const c of chamadas) {
          const saida = await executarFerramentaAgenda(c.name ?? "", c.input ?? {}, {
            clienteId: conv.cliente_id,
          });
          resultados.push({ type: "tool_result", tool_use_id: c.id, content: saida });
        }
        msgs.push({ role: "user", content: resultados });
        continue;
      }

      texto = blocos
        .filter((b) => b.type === "text" && b.text)
        .map((b) => b.text as string)
        .join("\n")
        .trim();
      break;
    }

    // Se o loop terminou SEM texto mas já houve ferramentas (estourou as iterações,
    // ou truncou em max_tokens no meio de um tool_use), a reserva pode já ter sido
    // criada. Faz UMA chamada final SEM ferramentas para o modelo fechar com texto
    // (ex.: "segurei o horário, segue o Pix") — evita hold criado sem resposta.
    if (!texto && msgs.length > mensagensApi.length) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: cfg.modelo_ia || "claude-haiku-4-5",
          max_tokens: 800,
          system,
          messages: msgs,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { content?: Bloco[] };
        texto = (data.content ?? [])
          .filter((b) => b.type === "text" && b.text)
          .map((b) => b.text as string)
          .join("\n")
          .trim();
      }
    }
  } catch (e) {
    return { enviada: false, motivo: String(e) };
  }
  if (!texto) return { enviada: false, motivo: "resposta vazia" };
  texto = limparTextoHigia(texto);

  // GUARDRAIL: a Hígia escala com [HUMANO] e NUNCA confirma pagamento/reserva.
  let escalar = /\[\s*HUMANO\s*\]/iu.test(texto);
  texto = texto.replace(/\[\s*HUMANO\s*\]/giu, "").trim();
  let violou = false;
  // Segunda linha de defesa pós-LLM (recall priorizado: falso-positivo só escala).
  // Cobre substantivo+verbo, verbo+substantivo, confirmações curtas e coloquiais.
  const RE_CONFIRMA = new RegExp(
    [
      "(pagamento|pix|comprovante|reserva)\\s+(foi\\s+|est[áa]\\s+|já\\s+)?(confirmad|aprovad|recebid|garantid|pag[oa])",
      "\\b(recebi|confirmei|aprovei|validei)\\b[^.!?\\n]{0,25}\\b(pix|pagamento|comprovante|reserva|valor)\\b",
      "(^|[\\n.!?]\\s*)(confirmad[oa]|aprovad[oa])\\s*[!.]",
      "\\b(t[áa]|est[áa])\\s+(tudo\\s+)?(pag[oa]|confirmad[oa])\\b",
      "\\b(pix|pagamento)\\b[^.!?\\n]{0,15}\\b(caiu|entrou|compensad[oa])\\b",
      "\\bquitad[oa]\\b",
    ].join("|"),
    "iu"
  );
  if (RE_CONFIRMA.test(texto)) {
    // Quem confirma pagamento é o CÓDIGO (processarComprovanteHigia), ao receber a
    // IMAGEM do comprovante — nunca o texto do LLM. Se o LLM tentou afirmar
    // confirmação (ex.: cliente mandou a palavra "comprovante" sem anexar o print),
    // troca por um pedido do comprovante real. NÃO escala (sem handoff para equipe).
    violou = true;
    texto =
      "Pra confirmar, me envia aqui o comprovante (print ou imagem) do Pix, tá? Assim que chegar eu confirmo na hora 🙏";
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
    if (!m) {
      // Identificador de mídia que não casa nada na biblioteca: registra para o
      // operador diagnosticar (a Hígia "prometeu" foto que não existe).
      await registrarAuditoria({
        acao: "atualizar",
        entidade: "whatsapp_conversas",
        registroId: conversaId,
        severidade: "warn",
        detalhes: `Hígia pediu mídia inexistente: "${token}" (foto não enviada).`,
      }).catch(() => undefined);
      continue;
    }
    const tipo = tipoWhatsapp(m.tipo_arquivo);
    const url = urlMidiaAbsoluta(m.arquivo_url);
    // Foto vai com a IDENTIFICAÇÃO curta da sala (ex.: "Sala 01") — o cliente precisa
    // saber qual é qual pra escolher. Usa o NOME (não a descrição longa, que confundia).
    const ehFoto = tipo === "image";
    const legenda = ehFoto ? m.nome : m.descricao || m.nome;
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
      conteudo: legenda ?? m.nome,
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

  if (escalar || violou) {
    await registrarAuditoria({
      acao: "atualizar",
      entidade: "whatsapp_conversas",
      registroId: conversaId,
      severidade: violou ? "warn" : "info",
      detalhes: violou
        ? "Guardrail: a Hígia tentou afirmar confirmação sem comprovante — texto trocado por pedido do print (sem escalar)."
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

  // Nada enviado pode ser legítimo (escalou só com [HUMANO], ou pediu [PIX] sem
  // chave configurada) — não é falha de envio e não deve disparar retry/DLQ.
  const motivo = algumOk
    ? undefined
    : escalar
      ? "escalado para humano (sem texto a enviar)"
      : "nada a enviar (resposta só com marcadores?)";
  return { enviada: algumOk, motivo };
}
