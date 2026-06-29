ALTER TABLE "salas" ADD COLUMN "tem_mesa" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "profissao" text;--> statement-breakpoint
ALTER TABLE "clientes" ADD COLUMN "perfil_qualificado_em" timestamp;--> statement-breakpoint

-- ===== Dados (UAT R03) — idempotente, aplicável em PRODUÇÃO =====
-- Sala 02 = SEM mesa (destino padrão de psicólogo/terapia de conversa).
UPDATE "salas" SET "tem_mesa" = false WHERE "nome" = 'Sala 02' AND "is_deleted" = false;--> statement-breakpoint
UPDATE "salas" SET "descricao" = 'Sala privativa climatizada, isolamento acústico, poltronas reclináveis (sem mesa) e Wi-Fi.'
  WHERE "nome" = 'Sala 02' AND "is_deleted" = false;--> statement-breakpoint

-- Base de conhecimento: internet / atendimento online (a Hígia precisa responder).
INSERT INTO "agente_base_conhecimento" ("categoria", "titulo", "conteudo", "prioridade", "ativo")
SELECT 'internet', 'Internet / atendimento online',
  'Sim, há Wi-Fi de alta qualidade em todas as salas, adequado para atendimento online por vídeo (telepsicologia, reuniões, mentorias). Quem atende online costuma preferir uma sala com mesa para apoiar o notebook.',
  1, true
WHERE NOT EXISTS (
  SELECT 1 FROM "agente_base_conhecimento" WHERE "categoria" = 'internet' AND "is_deleted" = false
);--> statement-breakpoint

-- Base de conhecimento: cadastro + aceite da política (formulário oficial).
INSERT INTO "agente_base_conhecimento" ("categoria", "titulo", "conteudo", "prioridade", "ativo")
SELECT 'cadastro', 'Cadastro e aceite da política',
  'Antes da primeira reserva, o cliente novo deve preencher o cadastro e aceitar a política de uso pelo formulário: https://docs.google.com/forms/d/e/1FAIpQLSdKhPouX6I5ll3l-o-vVREGD7oA4lAt8t7XuZLAzni8oWAYLA/viewform',
  1, true
WHERE NOT EXISTS (
  SELECT 1 FROM "agente_base_conhecimento" WHERE "categoria" = 'cadastro' AND "is_deleted" = false
);--> statement-breakpoint

-- Pagamento: confirmação agora é AUTOMÁTICA ao receber o comprovante (não mais "só a equipe").
UPDATE "agente_base_conhecimento"
  SET "conteudo" = 'Exclusivamente via Pix. O cliente faz o Pix e envia o comprovante aqui no WhatsApp; assim que chega, o sistema confirma a reserva automaticamente.'
  WHERE "categoria" = 'pagamento' AND "is_deleted" = false;