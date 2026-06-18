/**
 * Leitura de comprovante de pagamento (Pix/transferência) por IA de VISÃO.
 * ASSISTIVA: extrai os dados para a equipe conferir — NUNCA confirma o pagamento.
 */

export interface LeituraComprovante {
  valor: number | null; // em reais
  pagador: string | null;
  data: string | null; // data/hora como aparece no comprovante
  instituicao: string | null;
  id_transacao: string | null;
  e_pix: boolean | null;
  confianca: "alta" | "media" | "baixa" | null;
}

const TIPOS_IMAGEM = ["image/jpeg", "image/png", "image/webp", "image/gif"];

function blocoMidia(base64: string, mediaType: string): Record<string, unknown> | null {
  if (TIPOS_IMAGEM.includes(mediaType)) {
    return { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } };
  }
  if (mediaType === "application/pdf") {
    return { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } };
  }
  return null;
}

function extrairJson(texto: string): Record<string, unknown> | null {
  const ini = texto.indexOf("{");
  const fim = texto.lastIndexOf("}");
  if (ini < 0 || fim <= ini) return null;
  try {
    return JSON.parse(texto.slice(ini, fim + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function numero(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    // aceita "1.234,56" e "1234.56"
    const limpo = v.replace(/[^\d,.-]/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
    const n = Number(limpo);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

/** Lê um comprovante (imagem ou PDF em base64) e devolve os dados extraídos. */
export async function lerComprovante(
  base64: string,
  mediaType: string
): Promise<LeituraComprovante | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const midia = blocoMidia(base64, mediaType);
  if (!midia) return null;

  const system =
    "Você lê comprovantes de pagamento brasileiros (Pix, TED, transferência). Extraia os dados com precisão. " +
    "Responda APENAS um objeto JSON, sem texto fora dele.";
  const instrucao =
    "Extraia deste comprovante: valor (número, em reais), pagador (nome de quem PAGOU/enviou), data (data e hora como no comprovante), " +
    "instituicao (banco/instituição), id_transacao (id/E2E/autenticação se houver), e_pix (true se for Pix), confianca (alta|media|baixa conforme a legibilidade). " +
    'Use null quando não encontrar. Responda só o JSON: {"valor":..,"pagador":..,"data":..,"instituicao":..,"id_transacao":..,"e_pix":..,"confianca":..}';

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        system,
        messages: [{ role: "user", content: [midia, { type: "text", text: instrucao }] }],
      }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const txt = (data.content ?? []).filter((b) => b.type === "text").map((b) => b.text ?? "").join("\n");
    const obj = extrairJson(txt);
    if (!obj) return null;

    const conf = texto(obj.confianca)?.toLowerCase();
    return {
      valor: numero(obj.valor),
      pagador: texto(obj.pagador),
      data: texto(obj.data),
      instituicao: texto(obj.instituicao),
      id_transacao: texto(obj.id_transacao),
      e_pix: typeof obj.e_pix === "boolean" ? obj.e_pix : null,
      confianca: conf === "alta" || conf === "media" || conf === "baixa" ? conf : null,
    };
  } catch {
    return null;
  }
}
