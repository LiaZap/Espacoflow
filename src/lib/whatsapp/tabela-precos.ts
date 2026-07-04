/**
 * Tabela de investimento enviada como UMA única mensagem (a Hígia escreve o marcador
 * [TABELA]; o sistema monta a tabela COMPLETA a partir do banco — sem risco de o modelo
 * omitir linhas ou picar em várias mensagens). Evolution não tem botões/carrossel.
 */
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agentePrecos } from "@/lib/db/schema/agente";
import { formatarBRL } from "@/lib/utils";

const RE_TABELA = /\[\s*TABELA\s*\]/giu;

/** Remove o marcador [TABELA] do texto e informa se estava presente. */
export function extrairTabela(texto: string): { texto: string; temTabela: boolean } {
  const temTabela = RE_TABELA.test(texto);
  return {
    texto: texto.replace(RE_TABELA, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    temTabela,
  };
}

/**
 * Monta a tabela COMPLETA de valores (todas as linhas ativas de agente_precos, na ordem
 * cadastrada) numa única string, pronta pra enviar como uma só mensagem.
 */
export async function montarTabelaPrecos(): Promise<string | null> {
  const precos = await db
    .select()
    .from(agentePrecos)
    .where(and(eq(agentePrecos.is_deleted, false), eq(agentePrecos.ativo, true)))
    .orderBy(asc(agentePrecos.ordem));
  if (precos.length === 0) return null;

  const linhas = precos.map((p) => `• ${p.descricao.trim()}: ${formatarBRL(Math.round(Number(p.valor) * 100))}`);
  return ["*Investimento no Espaço Flow* 💰", "", ...linhas, "", "Pagamento via Pix. 😊"].join("\n");
}
