"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { agenteConfig, agentePrecos, agenteBaseConhecimento } from "@/lib/db/schema/agente";
import { configAgenteSchema } from "@/lib/validators/agente";
import { registrarAuditoria } from "@/lib/audit/logger";
import { montarPromptHigia } from "@/lib/agente/montar-prompt";
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
