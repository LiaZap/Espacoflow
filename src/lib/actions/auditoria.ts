"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditoria } from "@/lib/db/schema/auditoria";
import { usuarios } from "@/lib/db/schema/usuarios";
import { exigirPermissao } from "./_helpers";

export async function listarAuditoria(limite = 150) {
  await exigirPermissao("auditoria", "ler");
  return db
    .select({
      id: auditoria.id,
      usuario: usuarios.nome,
      acao: auditoria.acao,
      entidade: auditoria.entidade,
      severidade: auditoria.severidade,
      detalhes: auditoria.detalhes,
      created_at: auditoria.created_at,
    })
    .from(auditoria)
    .leftJoin(usuarios, eq(auditoria.user_id, usuarios.id))
    .where(eq(auditoria.is_deleted, false))
    .orderBy(desc(auditoria.created_at))
    .limit(limite);
}
