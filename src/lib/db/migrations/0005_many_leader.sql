ALTER TABLE "pagamentos" ADD COLUMN "valor_lido" numeric(12, 2);--> statement-breakpoint
ALTER TABLE "pagamentos" ADD COLUMN "pagador_lido" text;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD COLUMN "data_lida" text;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD COLUMN "leitura_obs" text;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD COLUMN "leitura_confere" boolean;--> statement-breakpoint
ALTER TABLE "pagamentos" ADD COLUMN "leitura_em" timestamp;