import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  numeric,
  date,
  time,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { salas } from "./salas";
import { clientes } from "./clientes";
import { whatsappConversas } from "./whatsapp";
import { clientesPacotes } from "./pacotes";

/**
 * Reservas de sala. Substitui `appointments`.
 * inicio_em/fim_em são derivados de data+hora+duracao (America/Sao_Paulo) na server action.
 * Anti-overbooking: checagem de conflito transacional na action + (migração) exclusion
 * constraint GiST (sala_id =, tstzrange(inicio_em,fim_em) &&) ignorando cancelada/no_show.
 * Optimistic locking por updated_at.
 */
export const reservas = pgTable(
  "reservas",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sala_id: uuid("sala_id")
      .notNull()
      .references(() => salas.id, { onDelete: "restrict" }),
    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    conversa_id: uuid("conversa_id").references(() => whatsappConversas.id, {
      onDelete: "restrict",
    }),
    pacote_cliente_id: uuid("pacote_cliente_id").references(() => clientesPacotes.id, {
      onDelete: "restrict",
    }),

    titulo: text("titulo").notNull().default("Uso de sala"),
    data: date("data").notNull(),
    hora: time("hora").notNull(),
    duracao_min: integer("duracao_min").notNull().default(60),
    inicio_em: timestamp("inicio_em", { withTimezone: true }),
    fim_em: timestamp("fim_em", { withTimezone: true }),

    // tour | uso_sala | reuniao_comercial | assinatura_contrato
    tipo: text("tipo").notNull().default("uso_sala"),
    // rascunho | pendente | confirmada | cancelada | concluida | no_show
    status_reserva: text("status_reserva").notNull().default("rascunho"),
    // nao_requerido | pendente | pago | reembolsado
    status_pagamento: text("status_pagamento").notNull().default("nao_requerido"),
    origem: text("origem").notNull().default("manual"), // manual | higia | site
    modalidade: text("modalidade").default("presencial"),
    requer_validacao_humana: boolean("requer_validacao_humana").notNull().default(false),
    horas_debitadas: numeric("horas_debitadas", { precision: 6, scale: 2 }),
    notas_internas: text("notas_internas"),
    google_event_id: text("google_event_id"), // id do evento no Google Calendar (sync)

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    salaIdx: index("idx_reservas_sala").on(t.sala_id),
    clienteIdx: index("idx_reservas_cliente").on(t.cliente_id),
    janelaIdx: index("idx_reservas_janela").on(t.sala_id, t.inicio_em, t.fim_em),
    statusIdx: index("idx_reservas_status").on(t.status_reserva, t.is_deleted),
  })
);

/** Participantes adicionais de uma reserva (máx. 3 pessoas na sala). */
export const reservasParticipantes = pgTable(
  "reservas_participantes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    reserva_id: uuid("reserva_id")
      .notNull()
      .references(() => reservas.id, { onDelete: "restrict" }),
    nome: text("nome").notNull(),
    contato: text("contato"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    reservaIdx: index("idx_reservas_participantes_reserva").on(t.reserva_id),
  })
);

export type Reserva = typeof reservas.$inferSelect;
export type NovaReserva = typeof reservas.$inferInsert;
export type ReservaParticipante = typeof reservasParticipantes.$inferSelect;
