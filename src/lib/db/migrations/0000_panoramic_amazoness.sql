CREATE TABLE "sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expira_em" timestamp NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "sessoes_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"role" text DEFAULT 'recepcao' NOT NULL,
	"telefone" text,
	"ultimo_acesso" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "usuarios_convites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'recepcao' NOT NULL,
	"token" text NOT NULL,
	"convidado_por" uuid,
	"expira_em" timestamp NOT NULL,
	"aceito_em" timestamp,
	"revogado_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "usuarios_convites_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"registro_id" uuid,
	"severidade" text DEFAULT 'info' NOT NULL,
	"detalhes" text,
	"dados_anteriores" text,
	"dados_novos" text,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "salas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text DEFAULT 'privativa' NOT NULL,
	"capacidade" integer DEFAULT 1 NOT NULL,
	"descricao" text,
	"ativa" boolean DEFAULT true NOT NULL,
	"reservavel_publicamente" boolean DEFAULT true NOT NULL,
	"prioridade_alocacao" integer DEFAULT 0 NOT NULL,
	"so_sob_pedido" boolean DEFAULT false NOT NULL,
	"preco_hora" numeric(12, 2),
	"endereco_fisico" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "salas_horarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sala_id" uuid NOT NULL,
	"dia_semana" integer NOT NULL,
	"abre_em" time NOT NULL,
	"fecha_em" time NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"nome_chamada" text,
	"telefone" text NOT NULL,
	"email" text,
	"documento" text,
	"status_lead" text DEFAULT 'novo' NOT NULL,
	"qualification_score" integer,
	"interesses" text,
	"dores" text,
	"origem" text,
	"bloqueado" boolean DEFAULT false NOT NULL,
	"aceitou_politica_em" timestamp,
	"ultima_atividade" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "clientes_telefone_unique" UNIQUE("telefone")
);
--> statement-breakpoint
CREATE TABLE "clientes_anotacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"tipo" text DEFAULT 'nota' NOT NULL,
	"titulo" text,
	"descricao" text,
	"agendado_para" timestamp,
	"concluido" boolean DEFAULT false NOT NULL,
	"concluido_em" timestamp,
	"criado_por" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clientes_consentimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"status_consentimento" text DEFAULT 'desconhecido' NOT NULL,
	"base_legal" text,
	"classificacao_dado" text,
	"origem_dado" text,
	"concedido_em" timestamp,
	"revogado_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"sessao_id" uuid,
	"status" text DEFAULT 'higia' NOT NULL,
	"atribuido_a" uuid,
	"ultima_mensagem_em" timestamp,
	"nao_lidas" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "whatsapp_conversas_estado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" uuid NOT NULL,
	"etapa" text DEFAULT 'inicio' NOT NULL,
	"sala_pretendida_id" uuid,
	"data_pretendida" date,
	"hora_pretendida" time,
	"duracao_pretendida_min" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "whatsapp_mensagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" uuid NOT NULL,
	"origem" text NOT NULL,
	"tipo" text DEFAULT 'text' NOT NULL,
	"conteudo" text,
	"midia_url" text,
	"midia_tipo" text,
	"status" text DEFAULT 'sent' NOT NULL,
	"processada_por_higia" boolean DEFAULT false NOT NULL,
	"tempo_resposta_ms" integer,
	"enviada_em" timestamp,
	"payload_bruto" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "whatsapp_sessoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provedor" text DEFAULT 'evolution' NOT NULL,
	"instancia_nome" text,
	"numero_telefone" text,
	"status" text DEFAULT 'desconectado' NOT NULL,
	"conectado_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clientes_pacotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"pacote_id" uuid NOT NULL,
	"horas_total" numeric(6, 2) NOT NULL,
	"horas_consumidas" numeric(6, 2) DEFAULT '0' NOT NULL,
	"horas_saldo" numeric(6, 2) NOT NULL,
	"valido_ate" date NOT NULL,
	"status" text DEFAULT 'ativo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "clientes_pacotes_movimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_pacote_id" uuid NOT NULL,
	"reserva_id" uuid,
	"tipo" text NOT NULL,
	"horas" numeric(6, 2) NOT NULL,
	"saldo_apos" numeric(6, 2) NOT NULL,
	"motivo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "pacotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"horas_incluidas" numeric(6, 2) NOT NULL,
	"validade_dias" integer DEFAULT 60 NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"tipo" text DEFAULT 'pacote' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "politica_cancelamento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"janela_horas" integer DEFAULT 12 NOT NULL,
	"percentual_devolvido" integer DEFAULT 100 NOT NULL,
	"validade_credito_dias" integer DEFAULT 60 NOT NULL,
	"ativa" boolean DEFAULT true NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reservas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sala_id" uuid NOT NULL,
	"cliente_id" uuid NOT NULL,
	"conversa_id" uuid,
	"pacote_cliente_id" uuid,
	"titulo" text DEFAULT 'Uso de sala' NOT NULL,
	"data" date NOT NULL,
	"hora" time NOT NULL,
	"duracao_min" integer DEFAULT 60 NOT NULL,
	"inicio_em" timestamp with time zone,
	"fim_em" timestamp with time zone,
	"tipo" text DEFAULT 'uso_sala' NOT NULL,
	"status_reserva" text DEFAULT 'rascunho' NOT NULL,
	"status_pagamento" text DEFAULT 'nao_requerido' NOT NULL,
	"origem" text DEFAULT 'manual' NOT NULL,
	"modalidade" text DEFAULT 'presencial',
	"requer_validacao_humana" boolean DEFAULT false NOT NULL,
	"horas_debitadas" numeric(6, 2),
	"notas_internas" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "reservas_participantes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reserva_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"contato" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"reserva_id" uuid,
	"cliente_pacote_id" uuid,
	"validado_por" uuid,
	"provedor" text DEFAULT 'pix_manual' NOT NULL,
	"valor" numeric(12, 2),
	"moeda" text DEFAULT 'BRL' NOT NULL,
	"status" text DEFAULT 'pendente' NOT NULL,
	"comprovante_url" text,
	"comprovante_recebido" boolean DEFAULT false NOT NULL,
	"pago_em" timestamp,
	"validado_em" timestamp,
	"id_externo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "agente_base_conhecimento" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"categoria" text NOT NULL,
	"titulo" text NOT NULL,
	"conteudo" text NOT NULL,
	"prioridade" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "agente_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"resposta_automatica" boolean DEFAULT true NOT NULL,
	"prompt_sistema" text,
	"modelo_ia" text DEFAULT 'claude-opus-4-8' NOT NULL,
	"quebra_mensagem" boolean DEFAULT true NOT NULL,
	"reserva_via_ia" boolean DEFAULT true NOT NULL,
	"audio_resposta" boolean DEFAULT false NOT NULL,
	"hora_inicio" time,
	"hora_fim" time,
	"dias_semana" text DEFAULT '0,1,2,3,4,5,6',
	"nome_espaco" text DEFAULT 'Espaço Flow' NOT NULL,
	"nome_agente" text DEFAULT 'Hígia' NOT NULL,
	"logo_url" text,
	"delay_min_seg" integer DEFAULT 2 NOT NULL,
	"delay_max_seg" integer DEFAULT 6 NOT NULL,
	"timezone" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "agente_midia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"descricao" text,
	"arquivo_url" text NOT NULL,
	"tipo_arquivo" text NOT NULL,
	"nome_arquivo" text,
	"tamanho" integer,
	"tags" text,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "agente_precos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sala_id" uuid,
	"pacote_id" uuid,
	"descricao" text NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"unidade" text DEFAULT 'hora' NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "jobs_fila" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"entidade" text,
	"entidade_id" uuid,
	"status" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"max_tentativas" integer DEFAULT 3 NOT NULL,
	"agendado_para" timestamp,
	"processado_em" timestamp,
	"erro" text,
	"idempotency_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid,
	CONSTRAINT "jobs_fila_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "lgpd_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retencao_dias_apos_cancelamento" integer DEFAULT 30 NOT NULL,
	"retencao_auditoria_dias" integer DEFAULT 365 NOT NULL,
	"exige_aprovacao_dsar" boolean DEFAULT false NOT NULL,
	"base_legal_padrao" text DEFAULT 'contract',
	"email_dpo" text,
	"url_privacidade" text,
	"url_termos" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "lgpd_solicitacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid,
	"nome_solicitante" text NOT NULL,
	"email_solicitante" text,
	"telefone_solicitante" text,
	"tipo" text NOT NULL,
	"status" text DEFAULT 'aberto' NOT NULL,
	"prioridade" text DEFAULT 'normal',
	"descricao" text,
	"atribuido_a" uuid,
	"prazo_em" timestamp,
	"resolvido_em" timestamp,
	"notas_resolucao" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
CREATE TABLE "documentos_versoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" uuid NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"arquivo_url" text NOT NULL,
	"gerado_por" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
ALTER TABLE "sessoes" ADD CONSTRAINT "sessoes_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios_convites" ADD CONSTRAINT "usuarios_convites_convidado_por_usuarios_id_fk" FOREIGN KEY ("convidado_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_user_id_usuarios_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "salas_horarios" ADD CONSTRAINT "salas_horarios_sala_id_salas_id_fk" FOREIGN KEY ("sala_id") REFERENCES "public"."salas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_anotacoes" ADD CONSTRAINT "clientes_anotacoes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_anotacoes" ADD CONSTRAINT "clientes_anotacoes_criado_por_usuarios_id_fk" FOREIGN KEY ("criado_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_consentimentos" ADD CONSTRAINT "clientes_consentimentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_sessao_id_whatsapp_sessoes_id_fk" FOREIGN KEY ("sessao_id") REFERENCES "public"."whatsapp_sessoes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversas" ADD CONSTRAINT "whatsapp_conversas_atribuido_a_usuarios_id_fk" FOREIGN KEY ("atribuido_a") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversas_estado" ADD CONSTRAINT "whatsapp_conversas_estado_conversa_id_whatsapp_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."whatsapp_conversas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_conversas_estado" ADD CONSTRAINT "whatsapp_conversas_estado_sala_pretendida_id_salas_id_fk" FOREIGN KEY ("sala_pretendida_id") REFERENCES "public"."salas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "whatsapp_mensagens" ADD CONSTRAINT "whatsapp_mensagens_conversa_id_whatsapp_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."whatsapp_conversas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_pacotes" ADD CONSTRAINT "clientes_pacotes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_pacotes" ADD CONSTRAINT "clientes_pacotes_pacote_id_pacotes_id_fk" FOREIGN KEY ("pacote_id") REFERENCES "public"."pacotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "clientes_pacotes_movimentos" ADD CONSTRAINT "clientes_pacotes_movimentos_cliente_pacote_id_clientes_pacotes_id_fk" FOREIGN KEY ("cliente_pacote_id") REFERENCES "public"."clientes_pacotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sala_id_salas_id_fk" FOREIGN KEY ("sala_id") REFERENCES "public"."salas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_conversa_id_whatsapp_conversas_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."whatsapp_conversas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_pacote_cliente_id_clientes_pacotes_id_fk" FOREIGN KEY ("pacote_cliente_id") REFERENCES "public"."clientes_pacotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reservas_participantes" ADD CONSTRAINT "reservas_participantes_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_reserva_id_reservas_id_fk" FOREIGN KEY ("reserva_id") REFERENCES "public"."reservas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_cliente_pacote_id_clientes_pacotes_id_fk" FOREIGN KEY ("cliente_pacote_id") REFERENCES "public"."clientes_pacotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD CONSTRAINT "pagamentos_validado_por_usuarios_id_fk" FOREIGN KEY ("validado_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agente_precos" ADD CONSTRAINT "agente_precos_sala_id_salas_id_fk" FOREIGN KEY ("sala_id") REFERENCES "public"."salas"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agente_precos" ADD CONSTRAINT "agente_precos_pacote_id_pacotes_id_fk" FOREIGN KEY ("pacote_id") REFERENCES "public"."pacotes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lgpd_solicitacoes" ADD CONSTRAINT "lgpd_solicitacoes_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lgpd_solicitacoes" ADD CONSTRAINT "lgpd_solicitacoes_atribuido_a_usuarios_id_fk" FOREIGN KEY ("atribuido_a") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos_versoes" ADD CONSTRAINT "documentos_versoes_gerado_por_usuarios_id_fk" FOREIGN KEY ("gerado_por") REFERENCES "public"."usuarios"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sessoes_token" ON "sessoes" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_sessoes_user" ON "sessoes" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_usuarios_email" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_usuarios_ativos" ON "usuarios" USING btree ("is_deleted");--> statement-breakpoint
CREATE INDEX "idx_convites_token" ON "usuarios_convites" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_convites_email" ON "usuarios_convites" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_auditoria_entidade" ON "auditoria" USING btree ("entidade");--> statement-breakpoint
CREATE INDEX "idx_auditoria_user" ON "auditoria" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_auditoria_criado" ON "auditoria" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_salas_ativas" ON "salas" USING btree ("is_deleted","ativa");--> statement-breakpoint
CREATE INDEX "idx_salas_horarios_sala" ON "salas_horarios" USING btree ("sala_id");--> statement-breakpoint
CREATE INDEX "idx_clientes_telefone" ON "clientes" USING btree ("telefone");--> statement-breakpoint
CREATE INDEX "idx_clientes_status" ON "clientes" USING btree ("status_lead","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_clientes_anotacoes_cliente" ON "clientes_anotacoes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_clientes_consentimentos_cliente" ON "clientes_consentimentos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_conversas_cliente" ON "whatsapp_conversas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_conversas_status" ON "whatsapp_conversas" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_conversas_estado_conversa" ON "whatsapp_conversas_estado" USING btree ("conversa_id");--> statement-breakpoint
CREATE INDEX "idx_mensagens_conversa" ON "whatsapp_mensagens" USING btree ("conversa_id");--> statement-breakpoint
CREATE INDEX "idx_clientes_pacotes_cliente" ON "clientes_pacotes" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_clientes_pacotes_status" ON "clientes_pacotes" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_movimentos_cliente_pacote" ON "clientes_pacotes_movimentos" USING btree ("cliente_pacote_id");--> statement-breakpoint
CREATE INDEX "idx_pacotes_ativos" ON "pacotes" USING btree ("is_deleted","ativo");--> statement-breakpoint
CREATE INDEX "idx_reservas_sala" ON "reservas" USING btree ("sala_id");--> statement-breakpoint
CREATE INDEX "idx_reservas_cliente" ON "reservas" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_reservas_janela" ON "reservas" USING btree ("sala_id","inicio_em","fim_em");--> statement-breakpoint
CREATE INDEX "idx_reservas_status" ON "reservas" USING btree ("status_reserva","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_reservas_participantes_reserva" ON "reservas_participantes" USING btree ("reserva_id");--> statement-breakpoint
CREATE INDEX "idx_pagamentos_cliente" ON "pagamentos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_pagamentos_status" ON "pagamentos" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_base_conhecimento_categoria" ON "agente_base_conhecimento" USING btree ("categoria","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs_fila" USING btree ("status","agendado_para");--> statement-breakpoint
CREATE INDEX "idx_lgpd_solicitacoes_status" ON "lgpd_solicitacoes" USING btree ("status","is_deleted");--> statement-breakpoint
CREATE INDEX "idx_documentos_entidade" ON "documentos_versoes" USING btree ("entidade","entidade_id","versao");--> statement-breakpoint
-- Anti-overbooking: impede duas reservas na mesma sala com horarios sobrepostos.
-- Ignora rascunho/cancelada/no_show e linhas sem janela calculada (inicio_em/fim_em).
CREATE EXTENSION IF NOT EXISTS btree_gist;--> statement-breakpoint
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_sem_overbooking" EXCLUDE USING gist ("sala_id" WITH =, tstzrange("inicio_em","fim_em") WITH &&) WHERE ("is_deleted" = false AND "status_reserva" NOT IN ('cancelada','no_show','rascunho') AND "inicio_em" IS NOT NULL AND "fim_em" IS NOT NULL);