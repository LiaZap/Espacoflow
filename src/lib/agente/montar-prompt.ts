import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig, agentePrecos, agenteBaseConhecimento } from "@/lib/db/schema/agente";
import { formatarBRL } from "@/lib/utils";
import { PROMPT_BASE_HIGIA } from "./prompt-base";

/**
 * Monta o prompt da Hígia em runtime, injetando persona (config) + preços + base
 * de conhecimento (tabelas = fonte única auditável). Nunca embute secrets.
 */
export async function montarPromptHigia(): Promise<string> {
  const [config] = await db
    .select()
    .from(agenteConfig)
    .where(eq(agenteConfig.is_deleted, false))
    .limit(1);

  const precos = await db
    .select()
    .from(agentePrecos)
    .where(and(eq(agentePrecos.is_deleted, false), eq(agentePrecos.ativo, true)))
    .orderBy(asc(agentePrecos.ordem));

  const base = await db
    .select()
    .from(agenteBaseConhecimento)
    .where(and(eq(agenteBaseConhecimento.is_deleted, false), eq(agenteBaseConhecimento.ativo, true)))
    .orderBy(asc(agenteBaseConhecimento.prioridade));

  const persona = config?.prompt_sistema?.trim() || PROMPT_BASE_HIGIA;

  const precosTxt =
    precos.length > 0
      ? precos
          .map((p, i) => `${i + 1}. ${p.descricao}: ${formatarBRL(Math.round(Number(p.valor) * 100))} / ${p.unidade}`)
          .join("\n")
      : "(consultar base atualizada antes de informar)";

  const baseTxt =
    base.length > 0
      ? base.map((b) => `- [${b.categoria}] ${b.titulo}: ${b.conteudo}`).join("\n")
      : "(sem itens cadastrados)";

  const horario =
    config?.hora_inicio && config?.hora_fim
      ? `${config.hora_inicio.slice(0, 5)}h às ${config.hora_fim.slice(0, 5)}h`
      : "07h às 23h";

  return persona
    .replaceAll("{{NOME_AGENTE}}", config?.nome_agente ?? "Hígia")
    .replaceAll("{{NOME_ESPACO}}", config?.nome_espaco ?? "Espaço Flow")
    .replaceAll("{{HORARIO}}", horario)
    .replaceAll("{{PRECOS}}", precosTxt)
    .replaceAll("{{BASE_CONHECIMENTO}}", baseTxt)
    .replaceAll(
      "{{DATA_HORA}}",
      new Date().toLocaleString("pt-BR", { timeZone: config?.timezone ?? "America/Sao_Paulo" })
    );
}
