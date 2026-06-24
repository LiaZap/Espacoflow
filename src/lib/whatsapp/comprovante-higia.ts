import { and, desc, eq, inArray, isNotNull, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { reservas } from "@/lib/db/schema/reservas";
import { agenteConfig } from "@/lib/db/schema/agente";
import { whatsappConversas, whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { lerComprovante, type LeituraComprovante } from "@/lib/documentos/ler-comprovante";
import { sincronizarReserva } from "@/lib/google/calendar";
import { registrarAuditoria } from "@/lib/audit/logger";
import { hojeSaoPaulo } from "@/lib/reservas/disponibilidade";
import { getProvider } from "./provider";
import { enviarHumanizado } from "./humanizar";

export interface ResultadoComprovante {
  tratou: boolean; // true = era comprovante e nós tratamos (não cai no LLM)
  enviada?: boolean;
  confirmada?: boolean;
}

function normalizar(s?: string | null): string {
  return (s ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos (diacríticos combinantes)
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** O comprovante foi para a conta do espaço? (favorecido bate com o beneficiário Pix). */
function favorecidoConfere(favorecido: string | null, beneficiario?: string | null): boolean {
  const ben = normalizar(beneficiario);
  const fav = normalizar(favorecido);
  if (!ben || !fav) return false; // sem beneficiário cadastrado ou sem favorecido lido → não confirma
  if (fav.includes(ben) || ben.includes(fav)) return true;
  const tokensBen = ben.split(" ").filter((t) => t.length >= 3);
  const tokensFav = new Set(fav.split(" "));
  return tokensBen.filter((t) => tokensFav.has(t)).length >= 2; // ao menos 2 nomes batem
}

/** Data do comprovante é claramente antiga (> 2 dias)? Só reprova se conseguir ler a data. */
function dataAntiga(data: string | null): boolean {
  if (!data) return false;
  let iso: string | null = null;
  let m = data.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) iso = `${m[1]}-${m[2]}-${m[3]}`;
  else {
    m = data.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (m) iso = `${m[3]}-${m[2]}-${m[1]}`;
  }
  if (!iso) return false;
  const d1 = new Date(`${iso}T00:00:00-03:00`).getTime();
  const d0 = new Date(`${hojeSaoPaulo()}T00:00:00-03:00`).getTime();
  if (Number.isNaN(d1)) return false;
  return Math.abs(d0 - d1) / 86_400_000 > 2;
}

/** Anti-reuso: o id da transação já foi usado para confirmar OUTRO pagamento? */
async function idTransacaoJaUsado(idTx: string | null, pgId: string): Promise<boolean> {
  if (!idTx) return false;
  const [r] = await db
    .select({ id: pagamentos.id })
    .from(pagamentos)
    .where(
      and(
        eq(pagamentos.id_externo, idTx),
        eq(pagamentos.status, "confirmado"),
        eq(pagamentos.is_deleted, false),
        ne(pagamentos.id, pgId)
      )
    )
    .limit(1);
  return Boolean(r);
}

function obsLeitura(l: LeituraComprovante): string {
  return [
    l.instituicao,
    l.favorecido ? `favorecido ${l.favorecido}` : null,
    l.id_transacao ? `id ${l.id_transacao}` : null,
    l.e_pix ? "Pix" : null,
    l.confianca ? `confiança ${l.confianca}` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Envia a resposta da Hígia (humanizada) e persiste como mensagem da conversa. */
async function responder(conversaId: string, telefone: string, texto: string): Promise<boolean> {
  const provider = getProvider();
  const r = await enviarHumanizado(provider, telefone, texto, {
    onBloco: async (bloco, idExterno, ok) => {
      await db.insert(whatsappMensagens).values({
        conversa_id: conversaId,
        origem: "higia",
        tipo: "text",
        conteudo: bloco,
        status: ok ? "sent" : "failed",
        processada_por_higia: true,
        enviada_em: new Date(),
        id_externo: idExterno ?? null,
      });
    },
  });
  await db
    .update(whatsappConversas)
    .set({ ultima_mensagem_em: new Date() })
    .where(eq(whatsappConversas.id, conversaId));
  return r.algumOk;
}

/**
 * Processa um comprovante enviado pelo CLIENTE no chat. A validação é feita em
 * CÓDIGO (não pelo LLM): só confirma automaticamente quando bate 100% — Pix, alta
 * confiança, valor exato da reserva, favorecido = conta do espaço, data recente e
 * comprovante não reutilizado. Qualquer divergência → escala para a equipe.
 */
export async function processarComprovanteHigia(params: {
  conversaId: string;
  clienteId: string;
  telefone: string;
  midiaUrl: string;
}): Promise<ResultadoComprovante> {
  // Pagamento pendente vinculado a uma reserva (o hold aguardando Pix).
  const [pg] = await db
    .select()
    .from(pagamentos)
    .where(
      and(
        eq(pagamentos.cliente_id, params.clienteId),
        eq(pagamentos.is_deleted, false),
        inArray(pagamentos.status, ["pendente", "em_analise"]),
        isNotNull(pagamentos.reserva_id)
      )
    )
    .orderBy(desc(pagamentos.created_at))
    .limit(1);
  if (!pg) return { tratou: false }; // sem reserva aguardando Pix → não é o fluxo de comprovante

  const escalarMsg =
    "Recebi seu comprovante! 🙏 Vou confirmar com a equipe e já te aviso por aqui, tá?";

  // Baixa a imagem do comprovante.
  let base64 = "";
  let mediaType = "image/jpeg";
  try {
    const res = await fetch(params.midiaUrl);
    if (!res.ok) throw new Error("download");
    mediaType = res.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    base64 = Buffer.from(await res.arrayBuffer()).toString("base64");
  } catch {
    await escalarConversa(params.conversaId, "Não consegui baixar o comprovante enviado.");
    const enviada = await responder(params.conversaId, params.telefone, escalarMsg);
    return { tratou: true, enviada, confirmada: false };
  }

  const leitura = await lerComprovante(base64, mediaType);
  // Guarda o comprovante e o que foi lido no pagamento (para a equipe, sempre).
  await db
    .update(pagamentos)
    .set({
      comprovante_url: params.midiaUrl,
      comprovante_recebido: true,
      ...(leitura
        ? {
            valor_lido: leitura.valor != null ? String(leitura.valor) : null,
            pagador_lido: leitura.pagador,
            data_lida: leitura.data,
            leitura_obs: obsLeitura(leitura),
            leitura_em: new Date(),
          }
        : {}),
      updated_at: new Date(),
    })
    .where(eq(pagamentos.id, pg.id));

  if (!leitura) {
    await escalarConversa(params.conversaId, "Não consegui ler o comprovante (sem chave de IA ou ilegível).");
    const enviada = await responder(params.conversaId, params.telefone, escalarMsg);
    return { tratou: true, enviada, confirmada: false };
  }

  const [cfg] = await db.select().from(agenteConfig).where(eq(agenteConfig.is_deleted, false)).limit(1);

  // Critérios estritos para confirmação automática (TODOS precisam passar).
  const motivos: string[] = [];
  if (leitura.e_pix !== true) motivos.push("não identificado como Pix");
  if (leitura.confianca !== "alta") motivos.push("leitura sem alta confiança");
  if (!(leitura.valor != null && pg.valor != null && Math.abs(leitura.valor - Number(pg.valor)) < 0.01)) {
    motivos.push("valor não confere com a reserva");
  }
  if (!favorecidoConfere(leitura.favorecido, cfg?.pix_beneficiario)) {
    motivos.push("favorecido não confere com a conta do espaço");
  }
  if (dataAntiga(leitura.data)) motivos.push("data do comprovante não é recente");
  if (await idTransacaoJaUsado(leitura.id_transacao, pg.id)) motivos.push("comprovante já utilizado");

  const confere = motivos.length === 0;
  await db.update(pagamentos).set({ leitura_confere: confere }).where(eq(pagamentos.id, pg.id));

  if (!confere) {
    await escalarConversa(params.conversaId, `Comprovante não validado automaticamente: ${motivos.join("; ")}.`);
    const enviada = await responder(params.conversaId, params.telefone, escalarMsg);
    return { tratou: true, enviada, confirmada: false };
  }

  // ===== Bateu 100% → confirma o pagamento e a reserva (decisão por critérios em código). =====
  await db.transaction(async (tx) => {
    await tx
      .update(pagamentos)
      .set({
        status: "confirmado",
        pago_em: new Date(),
        validado_em: new Date(),
        id_externo: leitura.id_transacao ?? pg.id_externo,
        // validado_por fica null = confirmado automaticamente pela Hígia (leitura IA).
        updated_at: new Date(),
      })
      .where(eq(pagamentos.id, pg.id));
    if (pg.reserva_id) {
      await tx
        .update(reservas)
        .set({ status_pagamento: "pago", status_reserva: "confirmada", updated_at: new Date() })
        .where(eq(reservas.id, pg.reserva_id));
    }
  });

  await registrarAuditoria({
    acao: "validar_pix",
    entidade: "pagamentos",
    registroId: pg.id,
    severidade: "warn",
    detalhes: `Pagamento CONFIRMADO automaticamente pela Hígia (leitura IA): ${obsLeitura(leitura)}`,
  }).catch(() => undefined);

  if (pg.reserva_id) await sincronizarReserva(pg.reserva_id).catch(() => undefined);

  const enviada = await responder(
    params.conversaId,
    params.telefone,
    "Pagamento confirmado! ✅ Sua reserva está garantida. Te espero no horário combinado 🙌"
  );
  return { tratou: true, enviada, confirmada: true };
}

/** Marca a conversa como atendimento humano e registra o motivo (escalada). */
async function escalarConversa(conversaId: string, motivo: string): Promise<void> {
  await db
    .update(whatsappConversas)
    .set({ status: "humano", ultima_mensagem_em: new Date(), updated_at: new Date() })
    .where(eq(whatsappConversas.id, conversaId));
  await registrarAuditoria({
    acao: "atualizar",
    entidade: "whatsapp_conversas",
    registroId: conversaId,
    severidade: "warn",
    detalhes: `Comprovante escalado para a equipe — ${motivo}`,
  }).catch(() => undefined);
}
