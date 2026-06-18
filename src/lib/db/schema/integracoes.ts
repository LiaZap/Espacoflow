import { pgTable, uuid, text, boolean, timestamp } from "drizzle-orm/pg-core";

/**
 * Configuração single-row da integração com o Google Agenda (Calendar).
 * Tokens de OAuth são dados operacionais da instalação (não secrets de build);
 * as credenciais do app (CLIENT_ID/SECRET) ficam em env, nunca aqui.
 */
export const googleAgendaConfig = pgTable("google_agenda_config", {
  id: uuid("id").primaryKey().defaultRandom(),

  conectado: boolean("conectado").notNull().default(false),
  conta_email: text("conta_email"),
  calendar_id: text("calendar_id").notNull().default("primary"),
  sincronizar: boolean("sincronizar").notNull().default(false),

  refresh_token: text("refresh_token"),
  access_token: text("access_token"),
  token_expira_em: timestamp("token_expira_em"),

  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
  is_deleted: boolean("is_deleted").notNull().default(false),
  modified_by: uuid("modified_by"),
});

export type GoogleAgendaConfig = typeof googleAgendaConfig.$inferSelect;
