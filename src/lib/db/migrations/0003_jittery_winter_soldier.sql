CREATE TABLE "google_agenda_config" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conectado" boolean DEFAULT false NOT NULL,
	"conta_email" text,
	"calendar_id" text DEFAULT 'primary' NOT NULL,
	"sincronizar" boolean DEFAULT false NOT NULL,
	"refresh_token" text,
	"access_token" text,
	"token_expira_em" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
ALTER TABLE "agente_config" ADD COLUMN "pix_chave" text;--> statement-breakpoint
ALTER TABLE "agente_config" ADD COLUMN "pix_beneficiario" text;--> statement-breakpoint
ALTER TABLE "agente_config" ADD COLUMN "pix_copia_cola" text;--> statement-breakpoint
ALTER TABLE "agente_config" ADD COLUMN "pix_instrucoes" text;