import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Trilha/auditoria dos jobs FIFO (o broker real é BullMQ/Redis).
 * Idempotência, retentativas, DLQ e status. Payload normalizado em colunas +
 * referência à entidade (nunca JSON longo).
 */
export const jobsFila = pgTable(
  "jobs_fila",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    tipo: text("tipo").notNull(), // enviar_whatsapp | processar_mensagem | gerar_pdf | ...
    entidade: text("entidade"),
    entidade_id: uuid("entidade_id"),
    // pendente | processando | concluido | falhou | dlq
    status: text("status").notNull().default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    max_tentativas: integer("max_tentativas").notNull().default(3),
    agendado_para: timestamp("agendado_para"),
    processado_em: timestamp("processado_em"),
    erro: text("erro"),
    idempotency_key: text("idempotency_key").unique(),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    statusIdx: index("idx_jobs_status").on(t.status, t.agendado_para),
  })
);

export type JobFila = typeof jobsFila.$inferSelect;
export type NovoJobFila = typeof jobsFila.$inferInsert;
