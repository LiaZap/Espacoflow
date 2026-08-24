# Regras do workspace — Espaço Flow

Regras para o agente do Antigravity / Codex neste repositório. Fonte completa:
[AGENTS.md](../../AGENTS.md).

## Contexto

Gestão do coworking Espaço Flow: salas, reservas, pacotes de horas, crédito em reais, pagamentos e a
**Hígia** — agente de WhatsApp que atende e reserva sozinha.

Next.js App Router · **Drizzle + PostgreSQL** · BullMQ + Redis · MongoDB · MinIO · Google Agenda.
Segue as regras absolutas da estrutura base (`../CLAUDE.md`): Drizzle, PostgreSQL, soft delete,
auditoria.

## Ordem de leitura

1. `docs/architecture.md`
2. `../CLAUDE.md` (estrutura base)
3. `src/lib/agente/prompt-base.ts`
4. O arquivo que você vai alterar

## Invariantes

1. Fuso fixo `-03:00` — nunca o relógio do servidor
2. Crédito é ledger append-only; saldo = soma das entradas não expiradas, piso zero
3. Crédito é tudo-ou-nada na reserva
4. Cancelar dentro da política vira crédito com validade, não devolução
5. Saldo tem titular — empresa com dois contatos consome um saldo só
6. Identidade é o telefone canônico, tratando o `0` de tronco
7. Hold expira
8. A Hígia não inventa apelido, sala nem preço — tudo vem de ferramenta
9. Eco da própria mensagem não cala a Hígia
10. Delete é lógico e toda ação é auditada
11. Trabalho longo vai para a fila, nunca inline no webhook

## Proibido

- `UPDATE` em saldo de crédito
- Horário pelo relógio do servidor
- Duplicar regra de reserva fora de `src/lib/reservas/`
- Ferramenta declarada sem implementação (ou o contrário)
- Processar WhatsApp inline no webhook
- Delete físico, Prisma ou SQLite
- Editar migração aplicada
- Logar telefone, CPF, e-mail ou valor em texto claro

## Comandos

`npm run dev` · `npm test` · `npm run typecheck` · `npm run sim` · `npm run worker` ·
`npm run db:migrate` · `npm run compliance`
