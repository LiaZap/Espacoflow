import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";

/**
 * Equipe interna do Espaço Flow que usa o backoffice.
 * Papéis (role): super_admin (time dev) | owner (Felipe) | admin | recepcao | visualizador.
 */
export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nome: text("nome").notNull(),
    email: text("email").notNull().unique(),
    senha_hash: text("senha_hash").notNull(),
    role: text("role").notNull().default("recepcao"),
    telefone: text("telefone"),
    ultimo_acesso: timestamp("ultimo_acesso"),

    // --- auditoria OBRIGATÓRIA ---
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    emailIdx: index("idx_usuarios_email").on(t.email),
    ativosIdx: index("idx_usuarios_ativos").on(t.is_deleted),
  })
);

/** Sessões de login (cookie HTTP-only guarda só o token opaco). */
export const sessoes = pgTable(
  "sessoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    user_id: uuid("user_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "restrict" }),
    token: text("token").notNull().unique(),
    expira_em: timestamp("expira_em").notNull(),
    ip: text("ip"),
    user_agent: text("user_agent"),

    // --- auditoria OBRIGATÓRIA ---
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    tokenIdx: index("idx_sessoes_token").on(t.token),
    userIdx: index("idx_sessoes_user").on(t.user_id),
  })
);

export type Usuario = typeof usuarios.$inferSelect;
export type NovoUsuario = typeof usuarios.$inferInsert;
export type Sessao = typeof sessoes.$inferSelect;
