"use server";

import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { agenteMidia } from "@/lib/db/schema/agente";
import { registrarAuditoria } from "@/lib/audit/logger";
import { uploadArquivo, minioConfigurado } from "@/lib/storage/minio";
import { slugMidia } from "@/lib/whatsapp/midia-marcadores";
import { exigirPermissao } from "./_helpers";

export type MidiaFormState = { erro?: string; ok?: boolean };

const TIPOS_OK = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

/** Lista a biblioteca de mídia que a Hígia pode enviar (fotos, PDFs). */
export async function listarMidia() {
  await exigirPermissao("agente", "ler");
  return db
    .select()
    .from(agenteMidia)
    .where(eq(agenteMidia.is_deleted, false))
    .orderBy(asc(agenteMidia.created_at));
}

/** Fotos das salas já incluídas no app (public/salas) — base inicial da galeria. */
const FOTOS_SALAS = [
  { nome: "Sala Privativa 01", tags: "sala-01", descricao: "Sala privativa para atendimento individual.", arquivo: "/salas/sala-01.jpg" },
  { nome: "Sala Privativa 02", tags: "sala-02", descricao: "Sala privativa para reuniões e mentorias.", arquivo: "/salas/sala-02.jpg" },
  { nome: "Sala Privativa 03", tags: "sala-03", descricao: "Sala privativa equipada para consultas.", arquivo: "/salas/sala-03.jpg" },
  { nome: "Lounge / Convivência", tags: "lounge", descricao: "Espaço de convivência e espera.", arquivo: "/salas/lounge.jpg" },
  { nome: "Ambiente do Espaço", tags: "ambiente", descricao: "Visão geral do coworking.", arquivo: "/salas/ambiente.jpg" },
];

/** Importa as fotos das salas que já vêm no app (1 clique, sem precisar do MinIO). */
export async function importarFotosSalas(): Promise<MidiaFormState & { adicionadas?: number }> {
  const sessao = await exigirPermissao("agente", "atualizar");

  let adicionadas = 0;
  for (const f of FOTOS_SALAS) {
    const [ex] = await db
      .select()
      .from(agenteMidia)
      .where(and(eq(agenteMidia.is_deleted, false), eq(agenteMidia.nome, f.nome)));
    if (ex) continue;
    await db.insert(agenteMidia).values({
      nome: f.nome,
      descricao: f.descricao,
      tags: f.tags,
      arquivo_url: f.arquivo,
      tipo_arquivo: "image/jpeg",
      nome_arquivo: f.arquivo.split("/").pop() ?? null,
      modified_by: sessao.userId,
    });
    adicionadas += 1;
  }

  if (adicionadas > 0) {
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "atualizar",
      entidade: "agente_midia",
      detalhes: `Importou ${adicionadas} foto(s) das salas`,
    });
  }

  revalidatePath("/agente");
  revalidatePath("/midia");
  return { ok: true, adicionadas };
}

/** Sobe uma nova mídia (foto/PDF) para o MinIO e cadastra na biblioteca. */
export async function criarMidia(_prev: MidiaFormState, formData: FormData): Promise<MidiaFormState> {
  const sessao = await exigirPermissao("agente", "atualizar");
  if (!minioConfigurado()) return { erro: "Storage (MinIO) não configurado no servidor." };

  const nome = String(formData.get("nome") ?? "").trim();
  const descricao = String(formData.get("descricao") ?? "").trim();
  const tags = String(formData.get("tags") ?? "").trim();
  const arquivo = formData.get("arquivo") as File | null;

  if (!nome) return { erro: "Informe um nome." };
  if (!arquivo || arquivo.size === 0) return { erro: "Selecione um arquivo." };
  if (arquivo.size > MAX_BYTES) return { erro: "Arquivo acima de 8 MB." };
  if (!TIPOS_OK.includes(arquivo.type)) {
    return { erro: "Tipo não suportado. Use JPG, PNG, WEBP, GIF ou PDF." };
  }

  const buffer = Buffer.from(await arquivo.arrayBuffer());
  const ext = (arquivo.name.split(".").pop() || "bin").toLowerCase();
  const chave = `agente-midia/${slugMidia(nome) || "midia"}-${Date.now()}.${ext}`;
  const url = await uploadArquivo(chave, buffer, arquivo.type || "application/octet-stream");

  const [novo] = await db
    .insert(agenteMidia)
    .values({
      nome,
      descricao: descricao || null,
      tags: tags || slugMidia(nome),
      arquivo_url: url,
      tipo_arquivo: arquivo.type || "application/octet-stream",
      nome_arquivo: arquivo.name,
      tamanho: arquivo.size,
      modified_by: sessao.userId,
    })
    .returning();

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "agente_midia",
    registroId: novo.id,
    detalhes: `Adicionou mídia "${nome}"`,
  });

  revalidatePath("/agente");
  revalidatePath("/midia");
  return { ok: true };
}

/** Ativa/desativa uma mídia (desativada não é oferecida nem enviada pela Hígia). */
export async function alternarMidia(id: string, ativo: boolean): Promise<MidiaFormState> {
  const sessao = await exigirPermissao("agente", "atualizar");
  if (!id) return { erro: "Mídia inválida." };

  await db
    .update(agenteMidia)
    .set({ ativo, updated_at: new Date(), modified_by: sessao.userId })
    .where(and(eq(agenteMidia.id, id), eq(agenteMidia.is_deleted, false)));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "agente_midia",
    registroId: id,
    detalhes: ativo ? "Ativou mídia" : "Desativou mídia",
  });

  revalidatePath("/agente");
  revalidatePath("/midia");
  return { ok: true };
}

/** Remove uma mídia (soft delete). */
export async function excluirMidia(id: string): Promise<MidiaFormState> {
  const sessao = await exigirPermissao("agente", "atualizar");
  if (!id) return { erro: "Mídia inválida." };

  await db
    .update(agenteMidia)
    .set({ is_deleted: true, deleted_at: new Date(), updated_at: new Date(), modified_by: sessao.userId })
    .where(eq(agenteMidia.id, id));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "agente_midia",
    registroId: id,
    detalhes: "Removeu mídia",
  });

  revalidatePath("/agente");
  revalidatePath("/midia");
  return { ok: true };
}
