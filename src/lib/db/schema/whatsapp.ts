import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  time,
  date,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { clientes } from "./clientes";
import { salas } from "./salas";
import { usuarios } from "./usuarios";

/**
 * Sessão/instância WhatsApp (Evolution API ou Meta Cloud).
 * SECRETS (tokens) NÃO ficam no banco — só provider, instância e status.
 */
export const whatsappSessoes = pgTable(
  "whatsapp_sessoes",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    provedor: text("provedor").notNull().default("evolution"), // evolution | meta_cloud
    instancia_nome: text("instancia_nome"),
    numero_telefone: text("numero_telefone"),
    status: text("status").notNull().default("desconectado"),
    conectado_em: timestamp("conectado_em"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  }
);

/** Thread de atendimento de um cliente. Substitui `conversations`. */
export const whatsappConversas = pgTable(
  "whatsapp_conversas",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    cliente_id: uuid("cliente_id")
      .notNull()
      .references(() => clientes.id, { onDelete: "restrict" }),
    sessao_id: uuid("sessao_id").references(() => whatsappSessoes.id, { onDelete: "restrict" }),
    status: text("status").notNull().default("higia"), // higia | humano | pausado
    atribuido_a: uuid("atribuido_a").references(() => usuarios.id, { onDelete: "restrict" }),
    ultima_mensagem_em: timestamp("ultima_mensagem_em"),
    nao_lidas: integer("nao_lidas").notNull().default(0),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    clienteIdx: index("idx_conversas_cliente").on(t.cliente_id),
    statusIdx: index("idx_conversas_status").on(t.status, t.is_deleted),
  })
);

/**
 * Mensagens da conversa. Substitui `messages`.
 * ÚNICO campo jsonb permitido no sistema: `payload_bruto` (payload cru do webhook).
 */
export const whatsappMensagens = pgTable(
  "whatsapp_mensagens",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    conversa_id: uuid("conversa_id")
      .notNull()
      .references(() => whatsappConversas.id, { onDelete: "restrict" }),
    origem: text("origem").notNull(), // user | higia | humano
    tipo: text("tipo").notNull().default("text"), // text | audio | image | document | video
    conteudo: text("conteudo"),
    midia_url: text("midia_url"),
    midia_tipo: text("midia_tipo"),
    status: text("status").notNull().default("sent"),
    processada_por_higia: boolean("processada_por_higia").notNull().default(false),
    tempo_resposta_ms: integer("tempo_resposta_ms"),
    enviada_em: timestamp("enviada_em"),
    id_externo: text("id_externo"), // id da mensagem no provedor (idempotência do webhook)
    // Exceção JSON do sistema: payload bruto do WhatsApp (terceiro, preservado integral).
    payload_bruto: jsonb("payload_bruto"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    conversaIdx: index("idx_mensagens_conversa").on(t.conversa_id),
    externoIdx: index("idx_mensagens_externo").on(t.id_externo),
  })
);

/**
 * Estado da máquina de agendamento por conversa.
 * `scheduling_context` (JSON na referência) normalizado em colunas tipadas.
 */
export const whatsappConversasEstado = pgTable(
  "whatsapp_conversas_estado",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    conversa_id: uuid("conversa_id")
      .notNull()
      .references(() => whatsappConversas.id, { onDelete: "restrict" }),
    etapa: text("etapa").notNull().default("inicio"),
    sala_pretendida_id: uuid("sala_pretendida_id").references(() => salas.id, {
      onDelete: "restrict",
    }),
    data_pretendida: date("data_pretendida"),
    hora_pretendida: time("hora_pretendida"),
    duracao_pretendida_min: integer("duracao_pretendida_min"),

    created_at: timestamp("created_at").notNull().defaultNow(),
    updated_at: timestamp("updated_at").notNull().defaultNow(),
    deleted_at: timestamp("deleted_at"),
    is_deleted: boolean("is_deleted").notNull().default(false),
    modified_by: uuid("modified_by"),
  },
  (t) => ({
    conversaIdx: index("idx_conversas_estado_conversa").on(t.conversa_id),
  })
);

export type WhatsappSessao = typeof whatsappSessoes.$inferSelect;
export type WhatsappConversa = typeof whatsappConversas.$inferSelect;
export type WhatsappMensagem = typeof whatsappMensagens.$inferSelect;
export type NovaWhatsappMensagem = typeof whatsappMensagens.$inferInsert;
export type WhatsappConversaEstado = typeof whatsappConversasEstado.$inferSelect;
