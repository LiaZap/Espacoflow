import { and, eq, inArray, notInArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig } from "@/lib/db/schema/agente";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
import { clientes } from "@/lib/db/schema/clientes";
import { whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { getProvider } from "./provider";

/** Fallback de acesso quando a sala ainda não tem código cadastrado (não vaza senha errada). */
const ACESSO_FALLBACK =
  "Assim que chegar, é só me chamar aqui que te passo o número da sala e a senha da fechadura 🙏";

/**
 * Envia a mensagem de boas-vindas / onboarding (com instruções de acesso) APÓS a reserva
 * confirmada. Usa o template editável em agente_config.msg_boas_vindas com {{SALA}} e
 * {{ACESSO}} (acesso por sala em salas.codigo_acesso). Best-effort: nunca quebra o fluxo.
 */
export async function enviarBoasVindas(reservaId: string, conversaId: string, telefone: string): Promise<void> {
  try {
    const [cfg] = await db
      .select({ msg: agenteConfig.msg_boas_vindas })
      .from(agenteConfig)
      .where(eq(agenteConfig.is_deleted, false))
      .limit(1);
    if (!cfg?.msg?.trim()) return; // sem template configurado → não envia

    const [r] = await db
      .select({ sala: salas.nome, acesso: salas.codigo_acesso })
      .from(reservas)
      .innerJoin(salas, eq(reservas.sala_id, salas.id))
      .where(eq(reservas.id, reservaId))
      .limit(1);
    if (!r) return;

    const acesso = r.acesso?.trim() || ACESSO_FALLBACK;
    const texto = cfg.msg.replaceAll("{{SALA}}", r.sala ?? "sua sala").replaceAll("{{ACESSO}}", acesso);

    const provider = getProvider();
    await provider.definirPresenca(telefone, "composing").catch(() => undefined);
    const envio = await provider.enviarTexto(telefone, texto);
    await db.insert(whatsappMensagens).values({
      conversa_id: conversaId,
      origem: "higia",
      tipo: "text",
      conteudo: texto,
      status: envio.ok ? "sent" : "failed",
      processada_por_higia: true,
      enviada_em: new Date(),
      id_externo: envio.idExterno ?? null,
    });
  } catch {
    // best-effort: a confirmação nunca falha por causa da mensagem de boas-vindas
  }
}

/**
 * Cliente NOVO para fins de onboarding: ainda não é "cliente" E não tem OUTRA reserva
 * confirmada/concluída FORA do lote recém-criado neste turno. Recebe TODOS os ids do lote
 * para não se auto-bloquear com uma reserva-irmã do mesmo turno.
 */
async function ehClienteNovoParaOnboarding(clienteId: string, reservaIdsLote: string[]): Promise<boolean> {
  const [cli] = await db
    .select({ status: clientes.status_lead })
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  if (cli?.status === "cliente") return false;
  const [outra] = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(
      and(
        eq(reservas.cliente_id, clienteId),
        eq(reservas.is_deleted, false),
        inArray(reservas.status_reserva, ["confirmada", "concluida"]),
        notInArray(reservas.id, reservaIdsLote)
      )
    )
    .limit(1);
  return !outra;
}

/**
 * Onboarding para reservas confirmadas por PACOTE/CRÉDITO (o fluxo de comprovante Pix não roda
 * nesses casos). Envia a MESMA mensagem de boas-vindas, só para cliente NOVO, uma vez por SALA.
 * Retorna quantas mensagens saíram (para o contador de blocos). Best-effort.
 */
export async function enviarOnboardingPacoteCredito(params: {
  clienteId: string;
  conversaId: string;
  telefone: string;
  reservaIds: string[];
}): Promise<number> {
  if (params.reservaIds.length === 0 || !params.telefone) return 0;
  if (!(await ehClienteNovoParaOnboarding(params.clienteId, params.reservaIds))) return 0;
  const rows = await db
    .select({ id: reservas.id, sala_id: reservas.sala_id })
    .from(reservas)
    .where(inArray(reservas.id, params.reservaIds));
  const salasEnviadas = new Set<string>();
  let enviados = 0;
  for (const r of rows) {
    if (salasEnviadas.has(r.sala_id)) continue;
    salasEnviadas.add(r.sala_id);
    await enviarBoasVindas(r.id, params.conversaId, params.telefone);
    enviados += 1;
  }
  return enviados;
}
