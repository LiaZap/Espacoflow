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
 * Mensagens do Pix, SEPARADAS para facilitar a cópia no WhatsApp:
 *   1) texto informativo (favorecido)  2) a CHAVE sozinha (toque-e-copie)
 *   3) o copia-e-cola sozinho (se houver)  4) a instrução do comprovante.
 */
export function montarMensagensPix(cfg?: PixCfg | null): string[] {
  const chave = cfg?.pix_chave?.trim();
  if (!chave) return [];

  const msgs: string[] = [];

  const intro = ["Aqui estão os dados pro Pix 👇"];
  if (cfg?.pix_beneficiario?.trim()) intro.push(`Favorecido: ${cfg.pix_beneficiario.trim()}`);
  msgs.push(intro.join("\n"));

  // A chave numa mensagem isolada — o cliente toca e copia direto.
  msgs.push(chave);

  const copia = cfg?.pix_copia_cola?.trim();
  if (copia) {
    msgs.push("Ou o Pix copia e cola (toque para copiar):");
    msgs.push(copia);
  }

  msgs.push(
    cfg?.pix_instrucoes?.trim() ||
      "Depois de pagar, me envia o comprovante aqui que eu confirmo na hora 🙏"
  );
  return msgs;
}
