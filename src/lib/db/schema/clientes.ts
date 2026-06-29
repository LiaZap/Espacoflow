import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { usuarios } from "./usuarios";

/**
 * Leads e clientes do coworking (captados pelo WhatsApp). Substitui `contacts`.
 * O `client_memory` (JSON na referência) foi normalizado em colunas tipadas.
 * Dedupe por telefone (validação por regex na server action).
 */
export const clientes = pgTable(
  "clientes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nome: text("nome").notNull(),
    nome_chamada: text("nome_chamada"),
    telefone: text("telefone").notNull().unique(),
    email: text("email"),
    documento: text("documento"),
    // novo | qualificando | apto | fora_perfil | cliente | inativo
    status_lead: text("status_lead").notNull().default("novo"),
    qualification_score: integer("qualification_score"),
    profissao: text("profissao"),
    interesses: text("interesses"),
    dores: text("dores"),
    origem: text("origem"),
    bloqueado: boolean("bloqueado").notNull().default(false),
    // Qualificação de perfil concluída (tipo de uso/pessoas/maca) — trava o agendamento
    // de cliente novo até ter sido qualificado.
    perfil_qualificado_em: timestamp("perfil_qualificado_em"),
    aceitou_politica_em: timestamp("aceitou_politica_em"),
    ultima_atividade: timestamp("ultima_atividade"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    telefoneIdx: index("idx_clientes_telefone").on(t.telefone),
    statusIdx: index("idx_clientes_status").on(t.status_lead, t.is_deleted),
  })
);

/** Notas/atividades por cliente (nota, ligação, tarefa, follow-up). */
export const clientesAnotacoes = pgTable(
  "clientes_anotacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    tipo: text("tipo").notNull().default("nota"),
    titulo: text("titulo"),
    descricao: text("descricao"),
    agendado_para: timestamp("agendado_para"),
    concluido: boolean("concluido").notNull().default(false),
    concluido_em: timestamp("concluido_em"),
    criado_por: uuid("criado_por").references(() => usuarios.id, { onDelete: "restrict" }),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    clienteIdx: index("idx_clientes_anotacoes_cliente").on(t.cliente_id),
  })
);

/** Consentimentos LGPD por cliente (status, base legal, classificação). */
export const clientesConsentimentos = pgTable(
  "clientes_consentimentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    status_consentimento: text("status_consentimento").notNull().default("desconhecido"),
    base_legal: text("base_legal"),
    classificacao_dado: text("classificacao_dado"),
    origem_dado: text("origem_dado"),
    concedido_em: timestamp("concedido_em"),
    revogado_em: timestamp("revogado_em"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    clienteIdx: index("idx_clientes_consentimentos_cliente").on(t.cliente_id),
  })
);

export type Cliente = typeof clientes.$inferSelect;
export type NovoCliente = typeof clientes.$inferInsert;
export type ClienteAnotacao = typeof clientesAnotacoes.$inferSelect;
export type ClienteConsentimento = typeof clientesConsentimentos.$inferSelect;
