import { db } from "@/lib/db";
import { auditoria } from "@/lib/db/schema/auditoria";

export interface EntradaAuditoria {
  userId?: string | null;
  acao: string; // criar | atualizar | excluir | login | logout | validar_pix | acesso_negado
  entidade: string;
  registroId?: string | null;
  severidade?: "info" | "warn" | "critical";
  detalhes?: string;
  dadosAnteriores?: unknown;
  dadosNovos?: unknown;
  ip?: string | null;
  userAgent?: string | null;
}

/** Registra uma entrada na trilha de auditoria (quem/o quê/quando). */
export async function registrarAuditoria(e: EntradaAuditoria): Promise<void> {
  await db.insert(auditoria).values({
    user_id: e.userId ?? null,
    acao: e.acao,
    entidade: e.entidade,
    registro_id: e.registroId ?? null,
    severidade: e.severidade ?? "info",
    detalhes: e.detalhes ?? null,
    dados_anteriores: e.dadosAnteriores != null ? JSON.stringify(e.dadosAnteriores) : null,
    dados_novos: e.dadosNovos != null ? JSON.stringify(e.dadosNovos) : null,
    ip: e.ip ?? null,
    user_agent: e.userAgent ?? null,
  });
}
