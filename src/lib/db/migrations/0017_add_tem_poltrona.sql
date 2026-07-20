ALTER TABLE "salas" ADD COLUMN "tem_poltrona" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Dado do Flow: a Sala 02 é a ÚNICA sem poltrona reclinável (as 01, 03 e 04 têm).
-- Sem isso o roteamento mandaria quem pede poltrona para a 02 (que é "sem mesa").
UPDATE "salas" SET "tem_poltrona" = false WHERE "nome" ILIKE '%02%';
