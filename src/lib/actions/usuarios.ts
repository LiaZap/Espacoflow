"use server";

import { and, asc, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { usuarios } from "@/lib/db/schema/usuarios";
import { temPapel, type Role } from "@/lib/auth/rbac";
import { criarUsuarioSchema, senhaSchema } from "@/lib/validators/usuarios";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao, primeiroErro } from "./_helpers";

const PAPEIS_ADMIN: Role[] = ["super_admin", "owner"];

/** Lista a equipe interna (sem o hash de senha). */
export async function listarUsuarios() {
  await exigirPermissao("usuarios", "ler");
  return db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      role: usuarios.role,
      ultimo_acesso: usuarios.ultimo_acesso,
      bloqueado_ate: usuarios.bloqueado_ate,
      created_at: usuarios.created_at,
    })
    .from(usuarios)
    .where(eq(usuarios.is_deleted, false))
    .orderBy(asc(usuarios.nome));
}

export type FormState = { erro?: string; ok?: boolean };

/** Cria um usuário interno (hash bcrypt da senha). */
export async function criarUsuario(_prev: FormState, formData: FormData): Promise<FormState> {
  const sessao = await exigirPermissao("usuarios", "criar");
  const parsed = criarUsuarioSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };
  const d = parsed.data;

  // Não permitir criar alguém com papel mais poderoso que o seu.
  if (!temPapel(sessao.role, d.role)) {
    return { erro: "Você não pode atribuir um papel superior ao seu." };
  }

  // E-mail único (a coluna é UNIQUE; checa antes para dar mensagem amigável).
  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, d.email));
  if (existe) return { erro: "Já existe um usuário com esse e-mail." };

  const senha_hash = await bcrypt.hash(d.senha, 10);
  const [novo] = await db
    .insert(usuarios)
    .values({ nome: d.nome, email: d.email, role: d.role, senha_hash, modified_by: sessao.userId })
    .returning({ id: usuarios.id });

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "criar",
    entidade: "usuarios",
    registroId: novo.id,
    detalhes: `Criou usuário ${d.email} (${d.role})`,
  });
  revalidatePath("/configuracoes/usuarios");
  return { ok: true };
}

/** Altera o papel de um usuário (com guarda de escalonamento). */
export async function alterarPapel(id: string, role: Role): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("usuarios", "atualizar");
  if (!temPapel(sessao.role, role)) {
    return { erro: "Você não pode atribuir um papel superior ao seu." };
  }

  const [alvo] = await db
    .select({ role: usuarios.role })
    .from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.is_deleted, false)));
  if (!alvo) return { erro: "Usuário não encontrado." };
  // Não permitir rebaixar/alterar alguém mais poderoso que você.
  if (!temPapel(sessao.role, alvo.role as Role)) {
    return { erro: "Você não pode alterar um usuário de papel superior ao seu." };
  }
  // Rebaixar o último admin máximo deixaria o sistema sem dono.
  if (PAPEIS_ADMIN.includes(alvo.role as Role) && !PAPEIS_ADMIN.includes(role) && (await contarAdmins()) <= 1) {
    return { erro: "Não é possível rebaixar o último administrador máximo." };
  }

  await db
    .update(usuarios)
    .set({ role, updated_at: new Date(), modified_by: sessao.userId })
    .where(and(eq(usuarios.id, id), eq(usuarios.is_deleted, false)));
  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "usuarios",
    registroId: id,
    detalhes: `Alterou papel para ${role}`,
  });
  revalidatePath("/configuracoes/usuarios");
  return {};
}

/** Redefine a senha de um usuário (e desbloqueia a conta). */
export async function redefinirSenha(id: string, senha: string): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("usuarios", "atualizar");
  const parsed = senhaSchema.safeParse(senha);
  if (!parsed.success) return { erro: primeiroErro(parsed.error.issues) };

  const [alvo] = await db
    .select({ role: usuarios.role })
    .from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.is_deleted, false)));
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (!temPapel(sessao.role, alvo.role as Role)) {
    return { erro: "Você não pode alterar um usuário de papel superior ao seu." };
  }

  const senha_hash = await bcrypt.hash(parsed.data, 10);
  await db
    .update(usuarios)
    .set({ senha_hash, login_falhas: 0, bloqueado_ate: null, updated_at: new Date(), modified_by: sessao.userId })
    .where(and(eq(usuarios.id, id), eq(usuarios.is_deleted, false)));
  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "usuarios",
    registroId: id,
    severidade: "warn",
    detalhes: "Redefiniu a senha",
  });
  revalidatePath("/configuracoes/usuarios");
  return {};
}

/** Desativa (soft delete) um usuário. Não permite desativar a si mesmo nem o último admin máximo. */
export async function desativarUsuario(id: string): Promise<{ erro?: string }> {
  const sessao = await exigirPermissao("usuarios", "excluir");
  if (id === sessao.userId) return { erro: "Você não pode desativar a própria conta." };

  const [alvo] = await db
    .select({ role: usuarios.role, email: usuarios.email })
    .from(usuarios)
    .where(and(eq(usuarios.id, id), eq(usuarios.is_deleted, false)));
  if (!alvo) return { erro: "Usuário não encontrado." };
  if (!temPapel(sessao.role, alvo.role as Role)) {
    return { erro: "Você não pode desativar um usuário de papel superior ao seu." };
  }
  if (PAPEIS_ADMIN.includes(alvo.role as Role) && (await contarAdmins()) <= 1) {
    return { erro: "Não é possível desativar o último administrador máximo." };
  }

  await db
    .update(usuarios)
    .set({ is_deleted: true, deleted_at: new Date(), updated_at: new Date(), modified_by: sessao.userId })
    .where(and(eq(usuarios.id, id), eq(usuarios.is_deleted, false)));
  await registrarAuditoria({
    userId: sessao.userId,
    acao: "excluir",
    entidade: "usuarios",
    registroId: id,
    severidade: "warn",
    detalhes: `Desativou usuário ${alvo.email}`,
  });
  revalidatePath("/configuracoes/usuarios");
  return {};
}

/** Conta administradores máximos (super_admin/owner) ativos — protege contra lockout. */
async function contarAdmins(): Promise<number> {
  const rows = await db
    .select({ id: usuarios.id })
    .from(usuarios)
    .where(and(inArray(usuarios.role, PAPEIS_ADMIN), eq(usuarios.is_deleted, false)));
  return rows.length;
}
