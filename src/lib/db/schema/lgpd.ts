import { pgTable, uuid, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { clientes } from "./clientes";
import { usuarios } from "./usuarios";

/** Política de governança LGPD (single-row, escopo global). */
export const lgpdConfig = pgTable("lgpd_config", {
  id: uuid("id").primaryKey().defaultRandom(),

  retencao_dias_apos_cancelamento: integer("retencao_dias_apos_cancelamento")
    .notNull()
    .default(30),
  retencao_auditoria_dias: integer("retencao_auditoria_dias").notNull().default(365),
  exige_aprovacao_dsar: boolean("exige_aprovacao_dsar").notNull().default(false),
  base_legal_padrao: text("base_legal_padrao").default("contract"),
  email_dpo: text("email_dpo"),
  url_privacidade: text("url_privacidade"),
  url_termos: text("url_termos"),

  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
  is_deleted: boolean("is_deleted").notNull().default(false),
  modified_by: uuid("modified_by"),
});

/** DSAR — pedidos de titulares de dados (7 tipos, prazo legal). */
export const lgpdSolicitacoes = pgTable(
  "lgpd_solicitacoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id").references(() => clientes.id, { onDelete: "restrict" }),
    nome_solicitante: text("nome_solicitante").notNull(),
    email_solicitante: text("email_solicitante"),
    telefone_solicitante: text("telefone_solicitante"),
    // acesso | retificacao | portabilidade | eliminacao | anonimizacao | revogacao | oposicao
    tipo: text("tipo").notNull(),
    status: text("status").notNull().default("aberto"), // aberto | em_andamento | resolvido | rejeitado
    prioridade: text("prioridade").default("normal"),
    descricao: text("descricao"),
    atribuido_a: uuid("atribuido_a").references(() => usuarios.id, { onDelete: "restrict" }),
    prazo_em: timestamp("prazo_em"),
    resolvido_em: timestamp("resolvido_em"),
    notas_resolucao: text("notas_resolucao"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    statusIdx: index("idx_lgpd_solicitacoes_status").on(t.status, t.is_deleted),
  })
);

export type LgpdConfig = typeof lgpdConfig.$inferSelect;
export type LgpdSolicitacao = typeof lgpdSolicitacoes.$inferSelect;
