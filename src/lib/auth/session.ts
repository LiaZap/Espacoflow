import { cookies } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessoes, usuarios } from "@/lib/db/schema/usuarios";
import type { Role } from "./rbac";

export const COOKIE_SESSAO = "flow_session";

export interface SessaoUsuario {
  userId: string;
  nome: string;
  email: string;
  role: Role;
}

/** Lê o cookie, valida a sessão no banco (não expirada, não deletada). */
export async function getSession(): Promise<SessaoUsuario | null> {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      userId: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
    })
    .from(sessoes)
    .innerJoin(usuarios, eq(sessoes.user_id, usuarios.id))
    .where(
      and(
        eq(sessoes.token, token),
        eq(sessoes.is_deleted, false),
        gt(sessoes.expira_em, new Date()),
        eq(usuarios.is_deleted, false)
      )
    );

  if (!row) return null;
  return { userId: row.userId, nome: row.nome, email: row.email, role: row.role as Role };
}

/** Igual a getSession, mas lança se não houver sessão (uso em Server Actions). */
export async function exigirSessao(): Promise<SessaoUsuario> {
  const s = await getSession();
  if (!s) throw new Error("Não autenticado");
  return s;
}
