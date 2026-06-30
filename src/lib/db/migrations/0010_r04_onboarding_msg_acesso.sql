ALTER TABLE "salas" ADD COLUMN "codigo_acesso" text;--> statement-breakpoint
ALTER TABLE "agente_config" ADD COLUMN "msg_boas_vindas" text;--> statement-breakpoint

-- ===== Dados (UAT R04) — onboarding pós-reserva. Idempotente. =====
-- Template da mensagem de boas-vindas/acesso (texto do cliente). {{SALA}} e {{ACESSO}}.
UPDATE "agente_config" SET "msg_boas_vindas" =
'*Seja muito bem-vinda(o) ao Espaço Flow!* 🌸

Que alegria ter você aqui! Sua reserva da {{SALA}} está confirmada. Desejamos um atendimento produtivo e tranquilo 🚀

{{ACESSO}}

Obs: use a sala reservada, de porta fechada. Não troque de sala sem a nossa confirmação — ela pode já estar locada. 🙏
Para abrir a fechadura por dentro, aperte o botão redondinho com o cadeadinho.

💧 Água: filtro na recepção.

Ao sair: desligue o ar-condicionado, deixe o display em LIVRE, apague as luzes e segure a porta fechada por fora uns 3 segundos até a fechadura travar 🙌

📶 Internet
3G — rede internetFlow3g, senha 1234flow
5G — rede flowcoworking, senha 1234flow

📍 Localização: https://maps.google.com/?cid=13531186749440921807'
WHERE "is_deleted" = false AND ("msg_boas_vindas" IS NULL OR "msg_boas_vindas" = '');--> statement-breakpoint

-- Acesso de exemplo (Felipe ajusta o de cada sala no painel de Salas).
UPDATE "salas" SET "codigo_acesso" =
'Ao chegar na sala 135, pressione a fechadura eletrônica por uns 2 segundos (as luzes do painel acendem) e digite a senha: 0135#'
WHERE "nome" = 'Sala 01' AND "is_deleted" = false AND "codigo_acesso" IS NULL;