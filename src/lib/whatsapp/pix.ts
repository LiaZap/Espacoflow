/**
 * Pix enviado como TEXTO (Evolution não envia botões). A Hígia escreve o marcador
 * [PIX]; aqui o sistema injeta a chave EXATA (sem risco do modelo inventar).
 */
import type { AgenteConfig } from "@/lib/db/schema/agente";

type PixCfg = Pick<
  AgenteConfig,
  "pix_chave" | "pix_beneficiario" | "pix_copia_cola" | "pix_instrucoes"
>;

const RE_PIX = /\[\s*PIX\s*\]/giu;

/** Remove o marcador [PIX] do texto e informa se ele estava presente. */
export function extrairPix(texto: string): { texto: string; temPix: boolean } {
  const temPix = RE_PIX.test(texto);
  return {
    texto: texto.replace(RE_PIX, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim(),
    temPix,
  };
}

export function pixConfigurado(cfg?: { pix_chave?: string | null } | null): boolean {
  return Boolean(cfg?.pix_chave?.trim());
}

/**
 * Mensagens do Pix: 1 amigável (favorecido + chave + instrução) e, se houver,
 * a "copia e cola" numa mensagem ISOLADA (fácil de copiar no WhatsApp).
 */
export function montarMensagensPix(cfg?: PixCfg | null): string[] {
  const chave = cfg?.pix_chave?.trim();
  if (!chave) return [];

  const linhas = ["Aqui estão os dados para o Pix 👇"];
  if (cfg?.pix_beneficiario?.trim()) linhas.push(`Favorecido: ${cfg.pix_beneficiario.trim()}`);
  linhas.push(`Chave: ${chave}`);
  linhas.push("");
  linhas.push(
    cfg?.pix_instrucoes?.trim() ||
      "Depois de pagar, me envie o comprovante aqui que eu registro 🙏"
  );

  const msgs = [linhas.join("\n")];

  const copia = cfg?.pix_copia_cola?.trim();
  if (copia) {
    msgs.push("Ou use o Pix copia e cola (toque para copiar):");
    msgs.push(copia); // mensagem isolada
  }
  return msgs;
}
