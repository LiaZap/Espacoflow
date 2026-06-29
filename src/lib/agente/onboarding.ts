import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, clientesConsentimentos } from "@/lib/db/schema/clientes";
import { registrarAuditoria } from "@/lib/audit/logger";

/** Máximo de pessoas por sala (acima disso o cliente está fora do perfil). */
export const MAX_PESSOAS = 3;

/** Mensagem oficial para cliente fora do perfil (maca/procedimento ou grupo > 3). */
export const MSG_FORA_PERFIL =
  "Desculpe, mas o Espaço Flow não atende ao seu perfil. Não temos estrutura para procedimentos que necessitam de maca nem reuniões com mais de 3 pessoas. Ficamos à disposição para outros serviços que possamos oferecer!";

/**
 * Registra a qualificação de perfil de um cliente novo (chamada pela Hígia via tool).
 * Se precisar de maca/procedimento corporal ou grupo > 3 → marca fora_perfil.
 * Caso contrário → marca perfil_qualificado_em (libera o agendamento) e guarda a profissão.
 * O `clienteId` vem do servidor (nunca do LLM).
 */
export async function registrarQualificacao(input: {
  clienteId: string;
  tipoUso?: string;
  pessoas?: number;
  precisaMaca?: boolean;
  profissao?: string;
}): Promise<{ apto: boolean; foraPerfil?: boolean; mensagem?: string }> {
  const [cli] = await db
    .select({ id: clientes.id, status: clientes.status_lead })
    .from(clientes)
    .where(and(eq(clientes.id, input.clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return { apto: false, mensagem: "Cliente não encontrado." };

  const foraPerfil =
    input.precisaMaca === true || (typeof input.pessoas === "number" && input.pessoas > MAX_PESSOAS);

  if (foraPerfil) {
    await db
      .update(clientes)
      .set({
        // Nunca rebaixa um cliente já promovido ("cliente") — só marca fora_perfil
        // quem ainda está em onboarding (novo/qualificando/apto).
        ...(cli.status !== "cliente" ? { status_lead: "fora_perfil" } : {}),
        ...(input.profissao ? { profissao: input.profissao } : {}),
        ...(input.tipoUso ? { interesses: input.tipoUso } : {}),
        updated_at: new Date(),
      })
      .where(eq(clientes.id, input.clienteId));
    await registrarAuditoria({
      acao: "atualizar",
      entidade: "clientes",
      registroId: input.clienteId,
      severidade: "info",
      detalhes: `Hígia qualificou: FORA DE PERFIL (maca/procedimento ou grupo > ${MAX_PESSOAS}).`,
    }).catch(() => undefined);
    return { apto: false, foraPerfil: true, mensagem: MSG_FORA_PERFIL };
  }

  await db
    .update(clientes)
    .set({
      perfil_qualificado_em: new Date(),
      ...(input.profissao ? { profissao: input.profissao } : {}),
      ...(input.tipoUso ? { interesses: input.tipoUso } : {}),
      // Promove para "apto" qualquer status que não seja "cliente" — inclusive recupera
      // de um "fora_perfil" anterior (re-qualificação positiva reabilita o agendamento).
      // NÃO mexe em "cliente" (isso só vem do aceite + 1ª reserva confirmada).
      ...(cli.status !== "cliente" ? { status_lead: "apto" } : {}),
      updated_at: new Date(),
    })
    .where(eq(clientes.id, input.clienteId));
  await registrarAuditoria({
    acao: "atualizar",
    entidade: "clientes",
    registroId: input.clienteId,
    severidade: "info",
    detalhes: `Hígia qualificou: apto${input.profissao ? ` (${input.profissao})` : ""}.`,
  }).catch(() => undefined);
  return { apto: true };
}

/**
 * Registra o aceite da política de uso (cadastro) feito pelo cliente no chat.
 * Preenche aceitou_politica_em e cria o registro de consentimento (LGPD). Idempotente.
 */
export async function registrarAceitePolitica(input: {
  clienteId: string;
  concordo: boolean;
}): Promise<{ ok: boolean; mensagem?: string }> {
  if (!input.concordo) {
    return {
      ok: false,
      mensagem: "O cliente ainda não aceitou a política — sem o aceite a reserva não pode ser confirmada.",
    };
  }
  const [cli] = await db
    .select({ id: clientes.id, aceito: clientes.aceitou_politica_em })
    .from(clientes)
    .where(and(eq(clientes.id, input.clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return { ok: false, mensagem: "Cliente não encontrado." };
  if (cli.aceito) return { ok: true }; // já aceitou antes — idempotente (caminho rápido)

  // Serializa por cliente e re-lê dentro do lock: dois turnos quase simultâneos do
  // mesmo cliente não podem inserir dois consentimentos (evita duplicar registro LGPD).
  const registrou = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${input.clienteId}))`);
    const [atual] = await tx
      .select({ aceito: clientes.aceitou_politica_em })
      .from(clientes)
      .where(eq(clientes.id, input.clienteId));
    if (atual?.aceito) return false; // outro turno já registrou
    await tx
      .update(clientes)
      .set({ aceitou_politica_em: new Date(), updated_at: new Date() })
      .where(eq(clientes.id, input.clienteId));
    await tx.insert(clientesConsentimentos).values({
      cliente_id: input.clienteId,
      status_consentimento: "aceito",
      base_legal: "consentimento",
      classificacao_dado: "cadastro",
      origem_dado: "whatsapp",
      concedido_em: new Date(),
    });
    return true;
  });
  if (registrou) {
    await registrarAuditoria({
      acao: "atualizar",
      entidade: "clientes",
      registroId: input.clienteId,
      severidade: "info",
      detalhes: "Cliente aceitou a política de uso (cadastro via WhatsApp).",
    }).catch(() => undefined);
  }
  return { ok: true };
}
