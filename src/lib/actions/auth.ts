"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { usuarios, sessoes } from "@/lib/db/schema/usuarios";
import { loginSchema } from "@/lib/validators/auth";
import { registrarAuditoria } from "@/lib/audit/logger";
import { COOKIE_SESSAO } from "@/lib/auth/session";

const SESSAO_DURACAO_MS = 8 * 60 * 60 * 1000; // 8h

export type LoginState = { erro?: string };

/** Server Action de login (uso com useActionState). Redireciona em caso de sucesso. */
export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    senha: formData.get("senha"),
  });
  // Mensagem genérica: nunca revelar se o e-mail existe.
  if (!parsed.success) return { erro: "Credenciais inválidas" };

  const email = parsed.data.email.toLowerCase().trim();
  const [usuario] = await db
    .select()
    .from(usuarios)
    .where(and(eq(usuarios.email, email), eq(usuarios.is_deleted, false)));

  if (!usuario) return { erro: "Credenciais inválidas" };

  const senhaOk = await bcrypt.compare(parsed.data.senha, usuario.senha_hash);
  if (!senhaOk) return { erro: "Credenciais inválidas" };

  const token = `${randomUUID()}${randomUUID().replace(/-/g, "")}`;
  const expira = new Date(Date.now() + SESSAO_DURACAO_MS);
  const h = await headers();

  await db.insert(sessoes).values({
    user_id: usuario.id,
    token,
    expira_em: expira,
    ip: h.get("x-forwarded-for") ?? null,
    user_agent: h.get("user-agent") ?? null,
    modified_by: usuario.id,
  });

  await db.update(usuarios).set({ ultimo_acesso: new Date() }).where(eq(usuarios.id, usuario.id));

  const store = await cookies();
  store.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    expires: expira,
    path: "/",
  });

  await registrarAuditoria({
    userId: usuario.id,
    acao: "login",
    entidade: "sessoes",
    detalhes: `Login de ${usuario.email}`,
    ip: h.get("x-forwarded-for") ?? null,
    userAgent: h.get("user-agent") ?? null,
  });

  redirect("/dashboard");
}

/** Encerra a sessão (soft delete — nunca delete físico) e limpa o cookie. */
export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_SESSAO)?.value;
  if (token) {
    await db
      .update(sessoes)
      .set({ is_deleted: true, deleted_at: new Date(), updated_at: new Date() })
      .where(eq(sessoes.token, token));
    store.delete(COOKIE_SESSAO);
  }
  redirect("/login");
}
