-- UAT R09 #2: completa o conjunto das 4 salas. A foto "Ambiente do Espaço" é, na verdade,
-- a Sala 04 — renomeia a mídia (mesma imagem/arquivo_url), mudando nome/tag/legenda para
-- que a Hígia envie as 4 salas. Idempotente (só age enquanto ainda estiver como "ambiente").
UPDATE "agente_midia"
SET "nome" = 'Sala Privativa 04',
    "tags" = 'sala-04',
    "descricao" = 'Sala privativa equipada, com mesa.',
    "updated_at" = now()
WHERE ("tags" = 'ambiente' OR "nome" = 'Ambiente do Espaço')
  AND "is_deleted" = false;
