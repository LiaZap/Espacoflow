import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig, agentePrecos, agenteBaseConhecimento } from "@/lib/db/schema/agente";
import { clientes } from "@/lib/db/schema/clientes";
import { obterMemoria } from "@/lib/mongo/client";
import { formatarBRL } from "@/lib/utils";
import { PROMPT_BASE_HIGIA } from "./prompt-base";

/**
 * Monta o prompt da Hígia em runtime, injetando persona (config) + preços + base
 * de conhecimento (tabelas = fonte única auditável). Nunca embute secrets.
 * Com `opts.clienteId`, injeta a memória do cliente (perfil + notas anteriores).
 */
export async function montarPromptHigia(opts?: { clienteId?: string }): Promise<string> {
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

  const prompt = persona
    .replaceAll("{{NOME_AGENTE}}", config?.nome_agente ?? "Hígia")
    .replaceAll("{{NOME_ESPACO}}", config?.nome_espaco ?? "Espaço Flow")
    .replaceAll("{{HORARIO}}", horario)
    .replaceAll("{{PRECOS}}", precosTxt)
    .replaceAll("{{BASE_CONHECIMENTO}}", baseTxt)
    .replaceAll(
      "{{DATA_HORA}}",
      new Date().toLocaleString("pt-BR", { timeZone: config?.timezone ?? "America/Sao_Paulo" })
    );

  if (!opts?.clienteId) return prompt;
  return prompt + (await blocoMemoria(opts.clienteId));
}

/** Bloco de memória do cliente (perfil no Postgres + notas no Mongo). */
async function blocoMemoria(clienteId: string): Promise<string> {
  const [cli] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return "";

  const mem = await obterMemoria(clienteId).catch(() => null);
  const linhas: string[] = [
    `- Nome: ${cli.nome}${cli.nome_chamada ? ` (chamar de ${cli.nome_chamada})` : ""}`,
    `- Status do lead: ${cli.status_lead}`,
  ];
  if (cli.interesses) linhas.push(`- Interesses: ${cli.interesses}`);
  if (cli.dores) linhas.push(`- Dores/necessidades: ${cli.dores}`);
  if (cli.aceitou_politica_em) linhas.push("- Já aceitou a política de uso.");
  if (mem?.resumo) linhas.push(`- Notas anteriores: ${String(mem.resumo)}`);
  if (mem?.ultima_interacao) linhas.push(`- Última interação: ${String(mem.ultima_interacao)}`);

  return `\n\n<memoria_cliente>\nVocê já conhece este cliente — use para personalizar o atendimento (e confirme dados sensíveis quando necessário):\n${linhas.join("\n")}\n</memoria_cliente>`;
}
