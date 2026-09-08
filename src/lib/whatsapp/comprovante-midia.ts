import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagamentos } from "@/lib/db/schema/pagamentos";

/**
 * A mídia recebida serve como comprovante? IMAGEM sempre serviu. DOCUMENTO só vale se for
 * PDF de verdade (PicPay/Nubank geram o comprovante em PDF) — um .docx/.xlsx/zip qualquer
 * NÃO pode dar uma reserva como paga, já que a confirmação aqui é direta.
 */
export function midiaEhComprovante(tipoMidia: string | undefined, mediaType: string, url: string): boolean {
  if (tipoMidia !== "document") return true;
  return mediaType === "application/pdf" || /\.pdf(\?|$)/i.test(url);
}

/** Mensagem mínima que este módulo precisa para achar o comprovante no histórico. */
export interface MsgHistorico {
  id?: string;
  /** payload cru do webhook — contem o arquivo em base64 ja descriptografado. */
  payload_bruto?: unknown;
  origem: string;
  tipo: string;
  midia_url: string | null;
  /** true = esta mídia JÁ foi avaliada pelo fluxo de comprovante (não reavaliar). */
  processada_por_higia?: boolean;
  created_at?: Date;
}

/**
 * Acha a MÍDIA do cliente que ainda NÃO foi avaliada pelo fluxo de comprovante.
 * Não olha só a última mensagem, porque dois casos reais quebravam isso:
 *  - o cliente manda o comprovante e escreve "Esse é o comprovante" / "Obrigado" depois;
 *  - alguém da equipe responde manualmente depois do comprovante.
 * Cada mídia é avaliada UMA vez (marcada como processada em seguida): assim uma foto antiga
 * que o cliente mandou por outro motivo nunca volta para confirmar uma reserva futura.
 */
export function acharComprovanteNovo(historico: MsgHistorico[]): MsgHistorico | undefined {
  for (let i = historico.length - 1; i >= 0; i--) {
    const m = historico[i];
    if (m.origem !== "user" || m.processada_por_higia) continue;
    if ((m.tipo === "image" || m.tipo === "document") && m.midia_url) return m;
  }
  return undefined;
}

/** Esta mídia já foi usada como comprovante de algum pagamento? (anti-reuso) */
export async function comprovanteJaUsado(midiaUrl: string): Promise<boolean> {
  const [r] = await db
    .select({ id: pagamentos.id })
    .from(pagamentos)
    .where(and(eq(pagamentos.comprovante_url, midiaUrl), eq(pagamentos.is_deleted, false)))
    .limit(1);
  return Boolean(r);
}

/**
 * Extrai o ARQUIVO (base64 ja descriptografado) do payload cru do webhook.
 * O Evolution manda a midia em base64 no proprio evento; a URL do WhatsApp e ".enc"
 * (criptografada) e nao serve para nada. Enquanto o MinIO nao guardar a copia, este e o
 * unico jeito de ler o comprovante — e vale sempre, porque dispensa rede.
 */
export function extrairBase64DoPayload(payload: unknown): string | null {
  const p = payload as Record<string, any> | null | undefined;
  if (!p) return null;
  const data = (p.data ?? p) as Record<string, any>;
  const cand = data?.message?.base64 ?? data?.base64 ?? p?.message?.base64 ?? p?.base64;
  if (typeof cand !== "string" || cand.length < 100) return null;
  return cand.includes(",") ? cand.slice(cand.indexOf(",") + 1) : cand;
}
