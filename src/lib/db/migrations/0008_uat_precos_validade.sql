-- UAT R01/R02: corrige preços (rótulos) e validade de pacotes em PRODUÇÃO.
-- Necessário porque não há tela de edição de preços e o seed é insert-only.

-- 1) "2h" e "4h" NÃO são pacotes — são tarifas avulsas por dia. Corrige os rótulos.
UPDATE "agente_precos" SET "descricao" = '2 horas', "unidade" = 'no dia'
  WHERE "descricao" = 'Pacote 2h';
UPDATE "agente_precos" SET "descricao" = 'Período de 4h (meia diária)', "unidade" = 'no dia'
  WHERE "descricao" = 'Pacote 4h';
UPDATE "agente_precos" SET "descricao" = 'Mensal fixo (1x/semana, 4h)'
  WHERE "descricao" = 'Plano mensal 4h/semana';
UPDATE "agente_precos" SET "descricao" = 'Diária (8h às 19h)'
  WHERE "descricao" = 'Diária';
UPDATE "agente_precos" SET "unidade" = 'pacote (3 meses)'
  WHERE "descricao" IN ('Pacote 10h', 'Pacote 20h', 'Pacote 40h');

-- 2) Pacotes reais (10/20/40h) valem 3 meses (90 dias), não 60.
UPDATE "pacotes" SET "validade_dias" = 90
  WHERE "nome" IN ('Pacote 10 horas', 'Pacote 20 horas', 'Pacote 40 horas') AND "is_deleted" = false;

-- 3) "Pacote 2 horas"/"Pacote 4 horas" não existem como pacote vendável (são avulsas):
--    soft delete (nunca delete físico).
UPDATE "pacotes" SET "is_deleted" = true, "deleted_at" = now()
  WHERE "nome" IN ('Pacote 2 horas', 'Pacote 4 horas') AND "is_deleted" = false;
