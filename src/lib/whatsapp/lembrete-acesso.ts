import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { whatsappConversas, whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { registrarAuditoria } from "@/lib/audit/logger";
import { formatarDataCurta } from "@/lib/utils";
import { getProvider } from "./provider";

/** Data de AMANHÃ no fuso America/Sao_Paulo como "YYYY-MM-DD" (compara com a coluna date). */
function amanhaSaoPaulo(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(Date.now() + 86_400_000)
  );
}

/** Instrução de acesso quando a sala ainda não tem código cadastrado (não vaza senha errada). */
const ACESSO_FALLBACK = "As instruções de acesso eu te passo por aqui — qualquer coisa, é só chamar 🙏";

/** Monta o texto do lembrete de acesso (~1 dia antes). Copy fixa + código de acesso da sala. */
function montarLembrete(nome: string | null, salaNome: string, data: string, hora: string | null, acesso: string | null): string {
  const primeiro = (nome ?? "").trim().split(/\s+/)[0];
  const saud = primeiro ? `Oi, ${primeiro}! ` : "Oi! ";
  const horaFmt = (hora ?? "").slice(0, 5);
  const acessoTxt = acesso?.trim() || ACESSO_FALLBACK;
  return (
    `${saud}Passando pra lembrar da sua reserva amanhã 📅\n` +
    `*${salaNome}* — ${formatarDataCurta(data)} às ${horaFmt}\n\n` +
    `${acessoTxt}\n\n` +
    `Lembra: a pontualidade é rigorosa, o tempo começa no horário marcado. Qualquer coisa, é só chamar! 🙌`
  );
}

/** Resolve a conversa da reserva (a da própria reserva ou a última do cliente). null se não houver. */
async function conversaDaReserva(conversaId: string | null, clienteId: string): Promise<string | null> {
  if (conversaId) return conversaId;
  const [c] = await db
    .select({ id: whatsappConversas.id })
    .from(whatsappConversas)
    .where(and(eq(whatsappConversas.cliente_id, clienteId), eq(whatsappConversas.is_deleted, false)))
    .orderBy(desc(whatsappConversas.ultima_mensagem_em))
    .limit(1);
  return c?.id ?? null;
}

/**
 * Envia o LEMBRETE de acesso (~1 dia antes) para todas as reservas CONFIRMADAS de amanhã que
 * ainda não foram lembradas. Idempotente: faz um "claim" atômico (UPDATE ... WHERE
 * instrucoes_enviadas_em IS NULL RETURNING) antes de enviar, então nunca manda 2x — mesmo se
 * o job rodar de novo. Chamado pelo worker (job diário). Retorna quantos lembretes saíram.
 */
export async function enviarLembretesDoDiaSeguinte(): Promise<{ enviados: number; total: number }> {
  const amanha = amanhaSaoPaulo();
  const linhas = await db
    .select({
      id: reservas.id,
      conversaId: reservas.conversa_id,
      clienteId: reservas.cliente_id,
      data: reservas.data,
      hora: reservas.hora,
      salaNome: salas.nome,
      acesso: salas.codigo_acesso,
      nome: clientes.nome,
      telefone: clientes.telefone,
    })
    .from(reservas)
    .innerJoin(salas, eq(reservas.sala_id, salas.id))
    .innerJoin(clientes, eq(reservas.cliente_id, clientes.id))
    .where(
      and(
        eq(reservas.is_deleted, false),
        eq(reservas.data, amanha),
        eq(reservas.status_reserva, "confirmada"),
        isNull(reservas.instrucoes_enviadas_em)
      )
    );

  const provider = getProvider();
  let enviados = 0;
  let falhas = 0;
  for (const r of linhas) {
    const telefone = (r.telefone ?? "").replace(/\D/g, "");
    if (!telefone) continue;

    // Claim atômico ANTES de enviar: impede envio duplicado se o job rodar concorrente/de novo
    // (o WHERE isNull só deixa UMA execução pegar a reserva).
    const claim = await db
      .update(reservas)
      .set({ instrucoes_enviadas_em: new Date(), updated_at: new Date() })
      .where(and(eq(reservas.id, r.id), isNull(reservas.instrucoes_enviadas_em)))
      .returning({ id: reservas.id });
    if (claim.length === 0) continue;

    const texto = montarLembrete(r.nome, r.salaNome, r.data, r.hora, r.acesso);
    const envio = await provider
      .enviarTexto(telefone, texto)
      .catch(() => ({ ok: false as boolean, idExterno: undefined as string | undefined }));

    if (!envio.ok) {
      // Envio falhou → DESFAZ o claim para reprocessar (não perder a entrega do código de acesso).
      await db
        .update(reservas)
        .set({ instrucoes_enviadas_em: null, updated_at: new Date() })
        .where(eq(reservas.id, r.id))
        .catch(() => undefined);
      falhas += 1;
      continue;
    }

    enviados += 1;
    const conversaId = await conversaDaReserva(r.conversaId, r.clienteId);
    if (conversaId) {
      await db
        .insert(whatsappMensagens)
        .values({
          conversa_id: conversaId,
          origem: "higia",
          tipo: "text",
          conteudo: texto,
          status: "sent",
          processada_por_higia: true,
          enviada_em: new Date(),
          id_externo: envio.idExterno ?? null,
        })
        .catch(() => undefined);
    }
    await registrarAuditoria({
      acao: "atualizar",
      entidade: "reservas",
      registroId: r.id,
      detalhes: `Lembrete de acesso (1 dia antes) enviado para ${r.nome ?? telefone} — ${r.salaNome} ${r.data}.`,
    }).catch(() => undefined);
  }

  // Se algum envio falhou, os claims foram revertidos (voltaram a isNull). Lança para a fila
  // reprocessar (attempts/backoff) e reenviar SÓ os que faltaram — os já enviados ficam marcados.
  if (falhas > 0) {
    throw new Error(`${falhas} lembrete(s) de acesso falharam no envio — reprocessar.`);
  }
  return { enviados, total: linhas.length };
}
