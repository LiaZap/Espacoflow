ALTER TABLE "usuarios" ADD COLUMN "login_falhas" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "usuarios" ADD COLUMN "bloqueado_ate" timestamp;