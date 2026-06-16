ALTER TABLE "whatsapp_mensagens" ADD COLUMN "id_externo" text;--> statement-breakpoint
CREATE INDEX "idx_mensagens_externo" ON "whatsapp_mensagens" USING btree ("id_externo");