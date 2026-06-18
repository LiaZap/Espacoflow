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
import { salas } from "./salas";
import { pacotes } from "./pacotes";

/**
 * Configuração single-row da Hígia. Substitui `nina_settings`.
 * SECRETS (chaves ElevenLabs/WhatsApp) NÃO ficam aqui — via env/cofre.
 */
export const agenteConfig = pgTable("agente_config", {
  id: uuid("id").primaryKey().defaultRandom(),

  ativo: boolean("ativo").notNull().default(true),
  resposta_automatica: boolean("resposta_automatica").notNull().default(true),
  prompt_sistema: text("prompt_sistema"),
  modelo_ia: text("modelo_ia").notNull().default("claude-haiku-4-5"),
  quebra_mensagem: boolean("quebra_mensagem").notNull().default(true),
  reserva_via_ia: boolean("reserva_via_ia").notNull().default(true),
  audio_resposta: boolean("audio_resposta").notNull().default(false),
  hora_inicio: time("hora_inicio"),
  hora_fim: time("hora_fim"),
  dias_semana: text("dias_semana").default("0,1,2,3,4,5,6"),
  nome_espaco: text("nome_espaco").notNull().default("Espaço Flow"),
  nome_agente: text("nome_agente").notNull().default("Hígia"),
  logo_url: text("logo_url"),
  delay_min_seg: integer("delay_min_seg").notNull().default(2),
  delay_max_seg: integer("delay_max_seg").notNull().default(6),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),

  // Pix enviado pela Hígia como TEXTO (Evolution não envia botões).
  pix_chave: text("pix_chave"),
  pix_beneficiario: text("pix_beneficiario"),
  pix_copia_cola: text("pix_copia_cola"),
  pix_instrucoes: text("pix_instrucoes"),

  created_at: timestamp("created_at").notNull().defaultNow(),
  updated_at: timestamp("updated_at").notNull().defaultNow(),
  deleted_at: timestamp("deleted_at"),
  is_deleted: boolean("is_deleted").notNull().default(false),
  modified_by: uuid("modified_by"),
});

/** Base de conhecimento estruturada (FAQ, regras, políticas) injetada no prompt em runtime. */
export const agenteBaseConhecimento = pgTable(
  "agente_base_conhecimento",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    categoria: text("categoria").notNull(),
    titulo: text("titulo").notNull(),
    conteudo: text("conteudo").notNull(),
    prioridade: integer("prioridade").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    categoriaIdx: index("idx_base_conhecimento_categoria").on(t.categoria, t.is_deleted),
  })
);

/** Tabela de preços auditável (fonte única injetada no prompt). */
export const agentePrecos = pgTable(
  "agente_precos",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    sala_id: uuid("sala_id").references(() => salas.id, { onDelete: "restrict" }),
    pacote_id: uuid("pacote_id").references(() => pacotes.id, { onDelete: "restrict" }),
    descricao: text("descricao").notNull(),
    valor: numeric("valor", { precision: 12, scale: 2 }).notNull(),
    unidade: text("unidade").notNull().default("hora"), // hora | pacote | diaria | mes
    ordem: integer("ordem").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  }
);

/** Biblioteca de mídia que a Hígia envia (PDFs de preços/planos, fotos das salas). */
export const agenteMidia = pgTable(
  "agente_midia",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    nome: text("nome").notNull(),
    descricao: text("descricao"),
    arquivo_url: text("arquivo_url").notNull(),
    tipo_arquivo: text("tipo_arquivo").notNull(),
    nome_arquivo: text("nome_arquivo"),
    tamanho: integer("tamanho"),
    tags: text("tags"),
    ativo: boolean("ativo").notNull().default(true),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  }
);

export type AgenteConfig = typeof agenteConfig.$inferSelect;
export type AgenteBaseConhecimento = typeof agenteBaseConhecimento.$inferSelect;
export type AgentePreco = typeof agentePrecos.$inferSelect;
export type AgenteMidia = typeof agenteMidia.$inferSelect;
