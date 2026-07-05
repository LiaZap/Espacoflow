import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { clientes } from "./clientes";

/** Catálogo de pacotes de horas (hora avulsa, 2h, 4h, 10h, 20h, 40h, diária, plano mensal). */
export const pacotes = pgTable(
  "pacotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nome: text("nome").notNull(),
    descricao: text("descricao"),
    horas_incluidas: numeric("horas_incluidas", { precision: 6, scale: 2 }).notNull(),
    validade_dias: integer("validade_dias").notNull().default(60),
    preco: numeric("preco", { precision: 12, scale: 2 }).notNull(),
    // avulsa | pacote | diaria | plano_mensal
    tipo: text("tipo").notNull().default("pacote"),
    ativo: boolean("ativo").notNull().default(true),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    ativosIdx: index("idx_pacotes_ativos").on(t.is_deleted, t.ativo),
  })
);

/** Pacote adquirido por um cliente — saldo de horas. Optimistic locking ao debitar/creditar. */
export const clientesPacotes = pgTable(
  "clientes_pacotes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    pacote_id: uuid("pacote_id")
      .notNull()
      .references(() => pacotes.id, { onDelete: "restrict" }),
    horas_total: numeric("horas_total", { precision: 6, scale: 2 }).notNull(),
    horas_consumidas: numeric("horas_consumidas", { precision: 6, scale: 2 })
      .notNull()
      .default("0"),
    horas_saldo: numeric("horas_saldo", { precision: 6, scale: 2 }).notNull(),
    valido_ate: date("valido_ate").notNull(),
    status: text("status").notNull().default("ativo"), // ativo | esgotado | expirado | cancelado

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    clienteIdx: index("idx_clientes_pacotes_cliente").on(t.cliente_id),
    statusIdx: index("idx_clientes_pacotes_status").on(t.status, t.is_deleted),
  })
);

/**
 * LEDGER append-only de movimentação de horas/créditos (fonte de verdade do saldo).
 * débito ao reservar, crédito ao cancelar dentro da política.
 * reserva_id é uma referência lógica (sem FK física para evitar ciclo de import).
 */
export const clientesPacotesMovimentos = pgTable(
  "clientes_pacotes_movimentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_pacote_id: uuid("cliente_pacote_id")
      .notNull()
      .references(() => clientesPacotes.id, { onDelete: "restrict" }),
    reserva_id: uuid("reserva_id"),
    tipo: text("tipo").notNull(), // debito | credito | ajuste | compra
    horas: numeric("horas", { precision: 6, scale: 2 }).notNull(),
    saldo_apos: numeric("saldo_apos", { precision: 6, scale: 2 }).notNull(),
    motivo: text("motivo"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    pacoteIdx: index("idx_movimentos_cliente_pacote").on(t.cliente_pacote_id),
  })
);

/**
 * LEDGER de CRÉDITO em REAIS do cliente (append-only). Cancelamento dentro da política
 * gera crédito (valor > 0, com validade); reservar consome (valor < 0). Saldo do cliente =
 * SUM(valor) das entradas NÃO expiradas e não deletadas (piso 0). reserva_id é referência
 * lógica (sem FK física p/ evitar ciclo de import). Optimistic via advisory lock por cliente.
 */
export const clientesCreditos = pgTable(
  "clientes_creditos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    reserva_id: uuid("reserva_id"),
    tipo: text("tipo").notNull(), // credito_cancelamento | debito_reserva | ajuste
    valor: numeric("valor", { precision: 12, scale: 2 }).notNull(), // + crédito, - débito (R$)
    expira_em: timestamp("expira_em"), // null = não expira (débitos/ajustes)
    motivo: text("motivo"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    clienteIdx: index("idx_creditos_cliente").on(t.cliente_id, t.is_deleted),
  })
);

/** Política de cancelamento versionada (janela em horas e % de crédito devolvido). */
export const politicaCancelamento = pgTable(
  "politica_cancelamento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    janela_horas: integer("janela_horas").notNull().default(12),
    percentual_devolvido: integer("percentual_devolvido").notNull().default(100),
    validade_credito_dias: integer("validade_credito_dias").notNull().default(60),
    ativa: boolean("ativa").notNull().default(true),
    versao: integer("versao").notNull().default(1),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  }
);

export type Pacote = typeof pacotes.$inferSelect;
export type NovoPacote = typeof pacotes.$inferInsert;
export type ClientePacote = typeof clientesPacotes.$inferSelect;
export type ClientePacoteMovimento = typeof clientesPacotesMovimentos.$inferSelect;
export type PoliticaCancelamento = typeof politicaCancelamento.$inferSelect;
export type ClienteCredito = typeof clientesCreditos.$inferSelect;
