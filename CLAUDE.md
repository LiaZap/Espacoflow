# CLAUDE.md — Espaço Flow

Regras para o Claude Code neste repositório. Espelha o [AGENTS.md](AGENTS.md) — se um dos dois mudar,
mude o outro na mesma alteração.

> **A Hígia fala com clientes reais no WhatsApp e reserva sala sozinha.** Erro de saldo vira cliente
> cobrado a mais; erro de disponibilidade vira sala dupla-reservada.

## Ordem de leitura obrigatória

1. [docs/architecture.md](docs/architecture.md)
2. `../CLAUDE.md` — regras absolutas da estrutura base (Drizzle, PostgreSQL, soft delete, auditoria,
   optimistic locking, modal de confirmação com block de 3s)
3. `src/lib/agente/prompt-base.ts`
4. O arquivo real que vai ser alterado

## Stack

Next.js App Router · TypeScript strict · **Drizzle + PostgreSQL** · **BullMQ + Redis** · MongoDB ·
MinIO/S3 · pdf-lib · Google Agenda (OAuth) · WhatsApp · Tailwind + shadcn · Zod · Vitest.

## Invariantes — nunca quebrar

1. **Fuso fixo `-03:00`** (sem horário de verão desde 2019) — nunca o relógio do servidor.
   → `src/lib/reservas/disponibilidade.ts`
2. **Crédito é ledger append-only**: saldo = `SUM(valor)` das entradas não expiradas, piso zero.
   Nunca `UPDATE` de saldo. → `src/lib/reservas/credito.ts`
3. **Crédito é tudo-ou-nada** — cobriu, sem Pix; não cobriu, a diferença por Pix.
4. **Cancelar dentro da política vira crédito com validade**, não devolução.
5. **Saldo tem titular** — empresa com dois contatos consome um saldo só. → `titular.ts`
6. **Identidade é o telefone canônico**, tratando o `0` de tronco.
7. **Hold expira.** → `expirar-holds.ts`
8. **A Hígia não inventa** apelido, sala nem preço — tudo vem de ferramenta.
9. **Eco da própria mensagem não cala a Hígia.**
10. **Delete é lógico e toda ação é auditada.**
11. **Trabalho longo vai para a fila**, nunca inline no webhook.

## Nunca fazer

- `UPDATE` em saldo de crédito em vez de nova entrada no ledger.
- Calcular horário pelo relógio do servidor.
- Duplicar regra de reserva na tela ou na server action em vez de chamar `src/lib/reservas/`.
- Deixar a Hígia responder preço ou disponibilidade sem chamar a ferramenta.
- Adicionar ferramenta em `ferramentas-defs.ts` sem implementar em `ferramentas.ts`.
- Processar mensagem de WhatsApp inline no webhook.
- Delete físico, Prisma ou SQLite — viola a estrutura base.
- Editar migração já aplicada.
- Logar telefone, CPF, e-mail ou valor em texto claro.
- Comitar `.env` ou credencial (WhatsApp, Google, MinIO).

## Sempre fazer

- Rodar `npm test` depois de mexer em preço, crédito, saldo, disponibilidade ou roteamento de sala —
  os cinco têm teste dedicado.
- Rodar `npm run sim` depois de mexer na Hígia.
- Rodar `npm run compliance` antes de concluir — é o auditor da estrutura base.
- Manter a paridade `AGENTS.md` ↔ `CLAUDE.md`.

## Comandos

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run sim
npm run worker
npm run db:generate
npm run db:migrate
npm run db:studio
npm run compliance
npm run map
```

## Checklist de saída

- [ ] Arquivos lidos antes de alterar
- [ ] Invariantes tocados
- [ ] Saída de `npm test` e `npm run typecheck`
- [ ] Saída de `npm run compliance`
- [ ] Se mexeu na Hígia: resultado do `npm run sim`
- [ ] Riscos residuais e o que ficou fora do escopo

## Higiene do repositório

A raiz tem arquivos-lixo de 0 byte com nomes como `a.created_at.getTime()`, `R$`, `({` — resíduo de
redirecionamento de shell mal escapado. Já houve uma limpeza (commit `4a3a6c2`) e voltaram. Ao rodar
`node -e` com parênteses e aspas no PowerShell, escreva um `.mjs` em `src/scripts/` em vez de comando
inline.
