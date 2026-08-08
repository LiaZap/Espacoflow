ALTER TABLE "clientes" ADD COLUMN "titular_id" uuid;
--> statement-breakpoint
-- Índice para achar rápido os contatos de um titular (usado ao excluir/validar o vínculo).
-- A FK auto-referente com RESTRICT vem na migração 0020 (gerada pelo drizzle-kit).
CREATE INDEX IF NOT EXISTS "idx_clientes_titular" ON "clientes" ("titular_id");
