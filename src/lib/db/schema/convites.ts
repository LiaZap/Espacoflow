import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { usuarios } from "./usuarios";

/** Convites por token para cadastrar novos operadores (ex.: recepção). */
export const usuariosConvites = pgTable(
  "usuarios_convites",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    email: text("email").notNull(),
    role: text("role").notNull().default("recepcao"),
    token: text("token").notNull().unique(),
    convidado_por: uuid("convidado_por").references(() => usuarios.id, { onDelete: "restrict" }),
    expira_em: timestamp("expira_em").notNull(),
    aceito_em: timestamp("aceito_em"),
    revogado_em: timestamp("revogado_em"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    tokenIdx: index("idx_convites_token").on(t.token),
    emailIdx: index("idx_convites_email").on(t.email),
  })
);

export type UsuarioConvite = typeof usuariosConvites.$inferSelect;
export type NovoUsuarioConvite = typeof usuariosConvites.$inferInsert;
