import { pgTable, uuid, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { usuarios } from "./usuarios";

/**
 * Trilha de auditoria: QUEM fez O QUE e QUANDO.
 * Snapshots ficam como texto (stringify), não como coluna JSON estruturada —
 * a regra "JSON só para WhatsApp" vale para o domínio, não para a trilha.
 */
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    user_id: uuid("user_id").references(() => usuarios.id, { onDelete: "restrict" }),
    acao: text("acao").notNull(), // criar | atualizar | excluir | login | logout | acesso_negado | validar_pix
    entidade: text("entidade").notNull(), // tabela/recurso afetado
    registro_id: uuid("registro_id"),
    severidade: text("severidade").notNull().default("info"), // info | warn | critical
    detalhes: text("detalhes"),
    dados_anteriores: text("dados_anteriores"),
    dados_novos: text("dados_novos"),
    ip: text("ip"),
    user_agent: text("user_agent"),

    // --- auditoria OBRIGATÓRIA (a própria tabela também segue o padrão) ---
    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    entidadeIdx: index("idx_auditoria_entidade").on(t.entidade),
    userIdx: index("idx_auditoria_user").on(t.user_id),
    criadoIdx: index("idx_auditoria_criado").on(t.created_at),
  })
);

export type RegistroAuditoria = typeof auditoria.$inferSelect;
export type NovoRegistroAuditoria = typeof auditoria.$inferInsert;
