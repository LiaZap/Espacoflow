/**
 * Tipo REAL de um arquivo pelos primeiros bytes (magic bytes), ignorando extensão e
 * content-type declarado. Necessário porque a mídia do WhatsApp é re-hospedada com extensão
 * e MIME genéricos ("document" → .bin / application/octet-stream), o que fazia um comprovante
 * em PDF ser descartado e um PNG ser enviado ao modelo declarado como JPEG (a API recusa).
 * Devolve null quando não reconhece — aí o chamador decide (nunca assume que é comprovante).
 */
export function tipoRealDoArquivo(buf: Buffer): string | null {
  if (buf.length < 12) return null;
  if (buf.subarray(0, 5).toString("latin1") === "%PDF-") return "application/pdf";
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "image/png";
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return "image/gif";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") {
    return "image/webp";
  }
  return null;
}
