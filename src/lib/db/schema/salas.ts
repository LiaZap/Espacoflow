import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  time,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

/**
 * Salas privativas reserváveis. Substitui `bookable_resources` da referência.
 * O `metadata` jsonb da referência foi normalizado em colunas (so_sob_pedido,
 * prioridade_alocacao) e na tabela salas_horarios.
 */
export const salas = pgTable(
  "salas",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nome: text("nome").notNull(),
    tipo: text("tipo").notNull().default("privativa"),
    capacidade: integer("capacidade").notNull().default(1),
    descricao: text("descricao"),
    ativa: boolean("ativa").notNull().default(true),
    reservavel_publicamente: boolean("reservavel_publicamente").notNull().default(true),
    prioridade_alocacao: integer("prioridade_alocacao").notNull().default(0),
    so_sob_pedido: boolean("so_sob_pedido").notNull().default(false),
    // Tem mesa/escrivaninha? Roteamento: psicólogo (terapia de conversa) vai p/ sala
    // SEM mesa; quem precisa de apoio p/ notebook vai p/ sala COM mesa.
    tem_mesa: boolean("tem_mesa").notNull().default(true),
    preco_hora: numeric("preco_hora", { precision: 12, scale: 2 }),
    endereco_fisico: text("endereco_fisico"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    ativasIdx: index("idx_salas_ativas").on(t.is_deleted, t.ativa),
  })
);

/** Janelas de funcionamento por sala e dia da semana (0=domingo .. 6=sábado). */
export const salasHorarios = pgTable(
  "salas_horarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sala_id: uuid("sala_id")
      .notNull()
      .references(() => salas.id, { onDelete: "restrict" }),
    dia_semana: integer("dia_semana").notNull(),
    abre_em: time("abre_em").notNull(),
    fecha_em: time("fecha_em").notNull(),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    salaIdx: index("idx_salas_horarios_sala").on(t.sala_id),
  })
);

export type Sala = typeof salas.$inferSelect;
export type NovaSala = typeof salas.$inferInsert;
export type SalaHorario = typeof salasHorarios.$inferSelect;
