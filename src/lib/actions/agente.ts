"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { agenteConfig, agentePrecos, agenteBaseConhecimento } from "@/lib/db/schema/agente";
import { configAgenteSchema } from "@/lib/validators/agente";
import { registrarAuditoria } from "@/lib/audit/logger";
import { montarPromptHigia } from "@/lib/agente/montar-prompt";
import { picarMensagem, limparTextoHigia } from "@/lib/whatsapp/humanizar";
import { exigirPermissao, atualizarComLock, primeiroErro } from "./_helpers";

export async function obterConfig() {
  await exigirPermissao("agente", "ler");
  const [c] = await db
    .select()
    .from(agenteConfig)
    .where(eq(agenteConfig.is_deleted, false))
    .limit(1);
  return c ?? null;
}

export async function previewPrompt(): Promise<string> {
  await exigirPermissao("agente", "ler");
  return montarPromptHigia();
}

export async function listarPrecos() {
  await exigirPermissao("agente", "ler");
  return db
    .select()
    .from(agentePrecos)
    .where(eq(agentePrecos.is_deleted, false))
    .orderBy(asc(agentePrecos.ordem));
}

export async function listarBaseConhecimento() {
  await exigirPermissao("agente", "ler");
  return db
    .select()
    .from(agenteBaseConhecimento)
    .where(eq(agenteBaseConhecimento.is_deleted, false))
    .orderBy(asc(agenteBaseConhecimento.prioridade));
}

export type TesteMsg = { role: "user" | "assistant"; content: string };
export type TesteResultado = { blocos?: string[]; modelo?: string; erro?: string };

/**
 * Chat de teste da Hígia (playground). Usa o MESMO prompt/modelo/base reais,
 * mas NÃO grava no banco nem envia pelo WhatsApp — é só para testar o atendimento.
 */
export async function testarHigia(mensagens: TesteMsg[]): Promise<TesteResultado> {
  await exigirPermissao("agente", "ler");

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { erro: "Defina ANTHROPIC_API_KEY no ambiente para testar a Hígia." };

  const limpas = (mensagens ?? [])
    .filter((m) => m?.content?.trim())
    .map((m) => ({ role: m.role === "assistant" ? ("assistant" as const) : ("user" as const), content: m.content.trim() }));
  if (limpas.length === 0) return { erro: "Envie uma mensagem." };

  const [cfg] = await db
    .select()
    .from(agenteConfig)
    .where(eq(agenteConfig.is_deleted, false))
    .limit(1);
  const modelo = cfg?.modelo_ia || "claude-haiku-4-5";
  const system = await montarPromptHigia();

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ model: modelo, max_tokens: 700, system, messages: limpas }),
    });
    if (!res.ok) return { erro: `Erro do modelo (HTTP ${res.status}).`, modelo };
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const texto = (data.content ?? [])
      .filter((b) => b.type === "text" && b.text)
      .map((b) => b.text as string)
      .join("\n")
      .trim();
    if (!texto) return { erro: "A Hígia não respondeu (resposta vazia).", modelo };
    return { blocos: picarMensagem(limparTextoHigia(texto)), modelo };
  } catch (e) {
    return { erro: String(e), modelo };
  }
}

export type FormState = { erro?: string; ok?: boolean };

export async function salvarConfig(_prev: FormState, formData: FormData): Promise<FormState> {
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Configuração não inicializada (rode o seed)." };
  const sessao = await exigirPermissao("agente", "atualizar");

  const parsed = configAgenteSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  const updatedAt = new Date(String(formData.get("updated_at") ?? ""));
  const r = await atualizarComLock(agenteConfig, id, updatedAt, {
    nome_espaco: d.nome_espaco,
    nome_agente: d.nome_agente,
    modelo_ia: d.modelo_ia,
    hora_inicio: d.hora_inicio ? `${d.hora_inicio}:00` : null,
    hora_fim: d.hora_fim ? `${d.hora_fim}:00` : null,
    prompt_sistema: d.prompt_sistema || null,
    resposta_automatica: formData.get("resposta_automatica") !== "false",
    reserva_via_ia: formData.get("reserva_via_ia") !== "false",
    modified_by: sessao.userId,
  });
  if ("erro" in r) return { erro: r.erro };

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "agente_config",
    registroId: id,
    detalhes: "Atualizou configuração da Hígia",
  });

  revalidatePath("/agente");
  return { ok: true };
}
