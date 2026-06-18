import {
  pgTable,
  uuid,
  text,
  boolean,
  numeric,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { reservas } from "./reservas";
import { clientesPacotes } from "./pacotes";
import { clientes } from "./clientes";
import { usuarios } from "./usuarios";

/**
 * Pagamentos PIX manuais com comprovante e validação HUMANA (nunca pela IA).
 * Substitui `coworking_payments`, generalizado para reserva OU compra de pacote.
 * O status do pagamento dirige o status da reserva/pacote.
 */
export const pagamentos = pgTable(
  "pagamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    reserva_id: uuid("reserva_id").references(() => reservas.id, { onDelete: "restrict" }),
    cliente_pacote_id: uuid("cliente_pacote_id").references(() => clientesPacotes.id, {
      onDelete: "restrict",
    }),
    validado_por: uuid("validado_por").references(() => usuarios.id, { onDelete: "restrict" }),

    provedor: text("provedor").notNull().default("pix_manual"),
    valor: numeric("valor", { precision: 12, scale: 2 }),
    moeda: text("moeda").notNull().default("BRL"),
    // pendente | em_analise | confirmado | recusado | reembolsado
    status: text("status").notNull().default("pendente"),
    comprovante_url: text("comprovante_url"),
    comprovante_recebido: boolean("comprovante_recebido").notNull().default(false),
    pago_em: timestamp("pago_em"),
    validado_em: timestamp("validado_em"),
    id_externo: text("id_externo"),

    // Leitura automática do comprovante (IA de visão) — ASSISTIVA: a equipe confirma.
    valor_lido: numeric("valor_lido", { precision: 12, scale: 2 }),
    pagador_lido: text("pagador_lido"),
    data_lida: text("data_lida"),
    leitura_obs: text("leitura_obs"),
    leitura_confere: boolean("leitura_confere"),
    leitura_em: timestamp("leitura_em"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    clienteIdx: index("idx_pagamentos_cliente").on(t.cliente_id),
    statusIdx: index("idx_pagamentos_status").on(t.status, t.is_deleted),
  })
);

export type Pagamento = typeof pagamentos.$inferSelect;
export type NovoPagamento = typeof pagamentos.$inferInsert;
