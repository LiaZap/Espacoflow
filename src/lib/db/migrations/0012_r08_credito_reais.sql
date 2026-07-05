CREATE TABLE "clientes_creditos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cliente_id" uuid NOT NULL,
	"reserva_id" uuid,
	"tipo" text NOT NULL,
	"valor" numeric(12, 2) NOT NULL,
	"expira_em" timestamp,
	"motivo" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp,
	"is_deleted" boolean DEFAULT false NOT NULL,
	"modified_by" uuid
);
--> statement-breakpoint
ALTER TABLE "clientes_creditos" ADD CONSTRAINT "clientes_creditos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_creditos_cliente" ON "clientes_creditos" USING btree ("cliente_id","is_deleted");