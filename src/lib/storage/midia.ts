import { uploadArquivo, minioConfigurado } from "./minio";

const EXT: Record<string, string> = {
  image: "jpg",
  audio: "ogg",
  document: "bin",
  video: "mp4",
};

/** Extensao a partir do mimetype REAL (o tipo "document" sozinho viraria .bin). */
const EXT_POR_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
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
    // Extensao pelo mimetype REAL: comprovante em PDF era salvo como .bin/octet-stream e
    // depois ninguem conseguia identificar que era um PDF.
    const ext = EXT_POR_MIME[contentType] ?? EXT[tipo] ?? "bin";
    const chave = `midia/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return await uploadArquivo(chave, buffer, contentType);
  } catch (e) {
    // NUNCA silenciar: um bucket vazio por meses foi o que escondeu a falha de comprovante.
    console.error("[midia] falha ao guardar mídia (base64) no MinIO:", (e as Error)?.message);
    return null;
  }
}

/** Baixa a mídia da URL do provedor e re-hospeda no MinIO (best-effort, com timeout). */
export async function persistirMidia(url: string, tipo: string, mimetype?: string): Promise<string | null> {
  if (!minioConfigurado()) return null;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;

    const buffer = Buffer.from(await res.arrayBuffer());
    if (buffer.length === 0 || buffer.length > 16 * 1024 * 1024) return null;

    const contentType = mimetype || res.headers.get("content-type") || "application/octet-stream";
    const ext = EXT_POR_MIME[contentType] ?? EXT[tipo] ?? "bin";
    const chave = `midia/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    return await uploadArquivo(chave, buffer, contentType);
  } catch (e) {
    console.error("[midia] falha ao guardar mídia (url) no MinIO:", (e as Error)?.message);
    return null;
  }
}
