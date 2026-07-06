import { uploadArquivo, minioConfigurado } from "./minio";

const EXT: Record<string, string> = {
  image: "jpg",
  audio: "ogg",
  document: "bin",
  video: "mp4",
};

const MIME_POR_TIPO: Record<string, string> = {
  image: "image/jpeg",
  audio: "audio/ogg",
  document: "application/octet-stream",
  video: "video/mp4",
};

/**
 * Re-hospeda mídia a partir do BASE64 já decodificado (o Evolution envia no webhook com
 * base64:true) — evita salvar a URL .enc criptografada do WhatsApp, que não abre. Gera um
 * arquivo com extensão padrão (jpg/ogg/mp4). Best-effort (null se MinIO off ou base64 ruim).
 */
export async function persistirMidiaBase64(
  base64: string,
  tipo: string,
  mimetype?: string
): Promise<string | null> {
  if (!minioConfigurado()) return null;
  try {
    // Remove prefixo data:...;base64, se vier embutido.
    const limpo = base64.includes(",") ? base64.slice(base64.indexOf(",") + 1) : base64;
    const buffer = Buffer.from(limpo, "base64");
    if (buffer.length === 0 || buffer.length > 16 * 1024 * 1024) return null;
    const contentType = mimetype || MIME_POR_TIPO[tipo] || "application/octet-stream";
    const ext = EXT[tipo] ?? "bin";
    const chave = `midia/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return await uploadArquivo(chave, buffer, contentType);
  } catch {
    return null;
  }
}

/** Baixa a mídia da URL do provedor e re-hospeda no MinIO (best-effort, com timeout). */
export async function persistirMidia(url: string, tipo: string): Promise<string | null> {
  if (!minioConfigurado()) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 16 * 1024 * 1024) return null;

    const contentType = res.headers.get("content-type") || "application/octet-stream";
    const ext = EXT[tipo] ?? "bin";
    const chave = `midia/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return await uploadArquivo(chave, buffer, contentType);
  } catch {
    return null;
  }
}
