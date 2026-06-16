import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { exigirSessao, type SessaoUsuario } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { registrarAuditoria } from "@/lib/audit/logger";

/** Garante sessão + permissão (recurso:acao). Loga acesso negado. Centraliza RBAC. */
export async function exigirPermissao(recurso: string, acao: string): Promise<SessaoUsuario> {
  const sessao = await exigirSessao();
  if (!temPermissao(sessao.role, recurso, acao)) {
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "acesso_negado",
      entidade: recurso,
      severidade: "warn",
      detalhes: `Tentativa de "${acao}" sem permissão.`,
    });
    throw new Error("Você não tem permissão para esta ação.");
  }
  return sessao;
}

export type ResultadoLock = { ok: true; registro: Record<string, unknown> } | { erro: string };

/**
 * Update com optimistic locking robusto: transação + SELECT ... FOR UPDATE e
 * comparação por epoch (ms) — evita o falso-conflito de precisão micro vs ms.
 */
export async function atualizarComLock(
  tabela: any,
  id: string,
  updatedAtOriginal: Date,
  valores: Record<string, unknown>
): Promise<ResultadoLock> {
  return db.transaction(async (tx) => {
    const [atual] = await tx
      .select({ updated_at: tabela.updated_at })
      .from(tabela)
      .where(and(eq(tabela.id, id), eq(tabela.is_deleted, false)))
      .for("update");

    if (!atual) return { erro: "Registro não encontrado ou já excluído." };
    if (new Date(atual.updated_at).getTime() !== new Date(updatedAtOriginal).getTime()) {
      return { erro: "Registro alterado por outro usuário. Recarregue e tente novamente." };
    }

    const [res] = await tx
      .update(tabela)
      .set({ ...valores, updated_at: new Date() })
      .where(eq(tabela.id, id))
      .returning();
    return { ok: true, registro: res };
  });
}

export function primeiroErro(issues: { message: string }[]): string {
  return issues[0]?.message ?? "Dados inválidos.";
}
