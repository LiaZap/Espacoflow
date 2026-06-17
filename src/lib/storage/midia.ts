import { uploadArquivo, minioConfigurado } from "./minio";

const EXT: Record<string, string> = {
  image: "jpg",
  audio: "ogg",
  document: "bin",
  video: "mp4",
};

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
