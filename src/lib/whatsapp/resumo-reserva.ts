import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { formatarDataCurta, formatarHoraCurta } from "@/lib/utils";
import { getProvider } from "./provider";

/**
 * Resumo padrão de reserva confirmada (formato do briefing — uma informação por LINHA):
 *   06/08/26
 *   Sala 01
 *   Início: 19h
 *   Término: 22h
 *   3 horas
 *   ✅ Reserva confirmada
 * Fonte ÚNICA do formato: usado tanto no fluxo de comprovante quanto na confirmação por
 * saldo/crédito — assim a confirmação nunca sai condensada numa linha pelo texto do LLM.
 */
export function resumoReservaTexto(d: {
  data: string;
  duracao_min: number;
  inicio_em: Date | null;
  fim_em: Date | null;
  sala: string;
}): string {
  const horas = d.duracao_min / 60;
  const lblHoras = horas === 1 ? "1 hora" : `${horas % 1 === 0 ? horas : horas.toFixed(1)} horas`;
  return [
    formatarDataCurta(d.data),
    d.sala,
    `Início: ${d.inicio_em ? formatarHoraCurta(d.inicio_em) : "—"}`,
    `Término: ${d.fim_em ? formatarHoraCurta(d.fim_em) : "—"}`,
    lblHoras,
    "✅ Reserva confirmada",
  ].join("\n");
}

/**
 * Envia o resumo padrão das reservas informadas (uma mensagem por reserva, sem picar) —
 * usado quando a reserva é confirmada por SALDO de pacote/CRÉDITO, fluxo em que não há
 * comprovante e a confirmação sairia só no texto livre do LLM. Best-effort.
 */
export async function enviarResumoReservas(params: {
  reservaIds: string[];
  conversaId: string;
  telefone: string;
}): Promise<number> {
  if (params.reservaIds.length === 0 || !params.telefone) return 0;
  const rows = await db
    .select({
      data: reservas.data,
      duracao_min: reservas.duracao_min,
      inicio_em: reservas.inicio_em,
      fim_em: reservas.fim_em,
      sala: salas.nome,
    })
    .from(reservas)
    .innerJoin(salas, eq(reservas.sala_id, salas.id))
    .where(inArray(reservas.id, params.reservaIds));

  const provider = getProvider();
  let enviados = 0;
  for (const r of rows) {
    const texto = resumoReservaTexto(r);
    await provider.definirPresenca(params.telefone, "composing").catch(() => undefined);
    const envio = await provider.enviarTexto(params.telefone, texto).catch(() => ({ ok: false, idExterno: undefined }));
    await db
      .insert(whatsappMensagens)
      .values({
        conversa_id: params.conversaId,
        origem: "higia",
        tipo: "text",
        conteudo: texto,
        status: envio.ok ? "sent" : "failed",
        processada_por_higia: true,
        enviada_em: new Date(),
        id_externo: envio.idExterno ?? null,
      })
      .catch(() => undefined);
    if (envio.ok) enviados += 1;
  }
  return enviados;
}
