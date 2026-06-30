import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig } from "@/lib/db/schema/agente";
import { reservas } from "@/lib/db/schema/reservas";
import { salas } from "@/lib/db/schema/salas";
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
