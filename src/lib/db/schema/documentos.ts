import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { usuarios } from "./usuarios";

/**
 * Versionamento incremental de documentos/PDFs gerados (recibos, contratos):
 * v1, v2, v3... com histórico completo (exigência do CLAUDE.md).
 */
export const documentosVersoes = pgTable(
  "documentos_versoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    tipo: text("tipo").notNull(), // recibo | contrato | relatorio
    entidade: text("entidade").notNull(), // reserva | pagamento | cliente_pacote
    entidade_id: uuid("entidade_id").notNull(),
    versao: integer("versao").notNull().default(1),
    arquivo_url: text("arquivo_url").notNull(),
    gerado_por: uuid("gerado_por").references(() => usuarios.id, { onDelete: "restrict" }),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    entidadeIdx: index("idx_documentos_entidade").on(t.entidade, t.entidade_id, t.versao),
  })
);

export type DocumentoVersao = typeof documentosVersoes.$inferSelect;
