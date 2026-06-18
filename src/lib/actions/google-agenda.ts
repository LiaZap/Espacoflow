"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { googleAgendaConfig } from "@/lib/db/schema/integracoes";
import { registrarAuditoria } from "@/lib/audit/logger";
import { exigirPermissao } from "./_helpers";

export type AgendaFormState = { erro?: string; ok?: boolean };

/** Config single-row da agenda (cria se não existir). */
export async function obterAgendaConfig() {
  await exigirPermissao("configuracoes", "ler");
  const [c] = await db
    .select()
    .from(googleAgendaConfig)
    .where(eq(googleAgendaConfig.is_deleted, false))
    .limit(1);
  if (c) return c;
  const [novo] = await db.insert(googleAgendaConfig).values({}).returning();
  return novo;
}

export async function salvarAgendaConfig(_prev: AgendaFormState, formData: FormData): Promise<AgendaFormState> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  const id = String(formData.get("id") ?? "");
  if (!id) return { erro: "Configuração não inicializada." };

  const calendar_id = String(formData.get("calendar_id") ?? "").trim() || "primary";
  const sincronizar = formData.get("sincronizar") === "true";

  await db
    .update(googleAgendaConfig)
    .set({ calendar_id, sincronizar, updated_at: new Date(), modified_by: sessao.userId })
    .where(eq(googleAgendaConfig.id, id));

  await registrarAuditoria({
    userId: sessao.userId,
    acao: "atualizar",
    entidade: "google_agenda_config",
    registroId: id,
    detalhes: "Atualizou configuração do Google Agenda",
  });

  revalidatePath("/configuracoes/agenda");
  return { ok: true };
}

export async function desconectarAgenda(): Promise<AgendaFormState> {
  const sessao = await exigirPermissao("configuracoes", "atualizar");
  const [c] = await db
    .select()
    .from(googleAgendaConfig)
    .where(eq(googleAgendaConfig.is_deleted, false))
    .limit(1);
  if (c) {
    await db
      .update(googleAgendaConfig)
      .set({
        conectado: false,
        conta_email: null,
        refresh_token: null,
        access_token: null,
        token_expira_em: null,
        updated_at: new Date(),
        modified_by: sessao.userId,
      })
      .where(eq(googleAgendaConfig.id, c.id));
    await registrarAuditoria({
      userId: sessao.userId,
      acao: "atualizar",
      entidade: "google_agenda_config",
      registroId: c.id,
      detalhes: "Desconectou o Google Agenda",
    });
  }
  revalidatePath("/configuracoes/agenda");
  return { ok: true };
}
