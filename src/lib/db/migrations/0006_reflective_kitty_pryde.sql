-- Idempotência atômica do webhook: índice único em whatsapp_mensagens.id_externo.
-- Antes de criar o índice, neutraliza eventuais id_externo duplicados (de corridas
-- antigas), mantendo a 1ª ocorrência e zerando o id_externo das demais — nenhuma
-- linha é removida (apenas perdem a chave externa, que já era redundante).
UPDATE "whatsapp_mensagens" m
SET "id_externo" = NULL
FROM (
  SELECT "id", row_number() OVER (
    PARTITION BY "id_externo" ORDER BY "created_at", "id"
  ) AS rn
  FROM "whatsapp_mensagens"
  WHERE "id_externo" IS NOT NULL
) dups
WHERE m."id" = dups."id" AND dups.rn > 1;--> statement-breakpoint
DROP INDEX "idx_mensagens_externo";--> statement-breakpoint
CREATE UNIQUE INDEX "uq_mensagens_externo" ON "whatsapp_mensagens" USING btree ("id_externo");
