/**
 * Mídia que a Hígia envia: ela escreve um marcador `[FOTO: identificador]` na
 * resposta; aqui extraímos o marcador, resolvemos a mídia na tabela agente_midia
 * e montamos a URL pública para o provedor (Evolution) enviar.
 */
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteMidia, type AgenteMidia } from "@/lib/db/schema/agente";

const RE_MARCADOR = /\[(?:FOTO|IMAGEM|ARQUIVO|PDF|M[IÍ]DIA)\s*:\s*([^\]\n]+)\]/giu;

/** Normaliza um texto em identificador estável (sem acento, espaço, extensão). */
export function slugMidia(s: string): string {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Extrai os marcadores [FOTO: x] do texto, devolvendo o texto LIMPO + identificadores. */
export function extrairMarcadores(texto: string): { texto: string; tokens: string[] } {
  const tokens: string[] = [];
  const limpo = texto.replace(RE_MARCADOR, (_m, id: string) => {
    id.split(/[,;]/)
      .map((t) => slugMidia(t))
      .filter(Boolean)
      .forEach((t) => tokens.push(t));
    return "";
  });
  return {
    texto: limpo.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    tokens: [...new Set(tokens)],
  };
}

/** Identificadores possíveis de uma mídia (nome, nome do arquivo, tags). */
function candidatos(m: AgenteMidia): string[] {
  return [
    slugMidia(m.nome),
    slugMidia(m.nome_arquivo ?? ""),
    ...(m.tags ?? "").split(/[,;]/).map((t) => slugMidia(t)),
  ].filter(Boolean);
}

/** Resolve um identificador de marcador para a mídia ATIVA correspondente. */
export async function resolverMidia(token: string): Promise<AgenteMidia | null> {
  const alvo = slugMidia(token);
  if (!alvo) return null;
  const itens = await db
    .select()
    .from(agenteMidia)
    .where(and(eq(agenteMidia.is_deleted, false), eq(agenteMidia.ativo, true)));
  return itens.find((m) => candidatos(m).includes(alvo)) ?? null;
}

/** Converte arquivo_url (relativo de /public ou absoluto) numa URL pública absoluta. */
export function urlMidiaAbsoluta(arquivoUrl: string): string {
  if (/^https?:\/\//i.test(arquivoUrl)) return arquivoUrl;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/${arquivoUrl.replace(/^\//, "")}`;
}

/** Mapeia o content-type para o tipo de mídia do WhatsApp/Evolution. */
export function tipoWhatsapp(tipoArquivo: string): "image" | "video" | "audio" | "document" {
  if (tipoArquivo?.startsWith("image/")) return "image";
  if (tipoArquivo?.startsWith("video/")) return "video";
  if (tipoArquivo?.startsWith("audio/")) return "audio";
  return "document";
}
