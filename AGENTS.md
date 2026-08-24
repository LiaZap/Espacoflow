# AGENTS.md — Espaço Flow

Instruções obrigatórias para qualquer agente de IA (Codex, Antigravity, Cursor, Copilot) neste
repositório. Claude Code lê o [CLAUDE.md](CLAUDE.md), que espelha este arquivo.

> **A Hígia fala com clientes reais no WhatsApp e reserva sala sozinha.** Um erro de saldo ou de
> disponibilidade vira cliente cobrado a mais, ou sala dupla-reservada.

## 1. Ordem de leitura obrigatória

1. [docs/architecture.md](docs/architecture.md) — mapa, invariantes, anti-padrões
2. `../CLAUDE.md` — **regras absolutas da estrutura base** (Drizzle, PostgreSQL, soft delete,
   auditoria, optimistic locking, modal de confirmação com block)
3. `src/lib/agente/prompt-base.ts` — quem é a Hígia e o que ela pode dizer
4. O arquivo real que você vai alterar

## 2. Invariantes — nunca quebrar

| # | Invariante | Onde vive |
| :-- | :--- | :--- |
| 1 | **Fuso fixo `-03:00`** — sem horário de verão no Brasil desde 2019. Nunca use o relógio do servidor. | `src/lib/reservas/disponibilidade.ts` |
| 2 | **Crédito é ledger append-only.** Saldo = `SUM(valor)` das entradas não expiradas, piso zero. Nunca `UPDATE` de saldo. | `src/lib/reservas/credito.ts` |
| 3 | **Crédito é tudo-ou-nada.** Cobriu, não sai Pix; não cobriu, a diferença vai por Pix. | `credito.ts` |
| 4 | **Cancelar dentro da política vira crédito com validade**, não devolução. | `politica_cancelamento` |
| 5 | **Saldo tem titular.** Empresa com dois contatos autorizados consome **um** saldo. | `src/lib/reservas/titular.ts` |
| 6 | **Identidade é o telefone canônico**, tratando o `0` de tronco. | `src/scripts/dedup-clientes.ts` |
| 7 | **Hold expira** — reserva segurada e não confirmada é liberada. | `expirar-holds.ts` |
| 8 | **A Hígia não inventa** apelido, sala nem preço: tudo vem de ferramenta. | `src/lib/agente/ferramentas.ts` |
| 9 | **Eco da própria mensagem não cala a Hígia.** | tratamento do webhook |
| 10 | **Delete é lógico e toda ação é auditada.** | `src/lib/audit/`, regra da base |
| 11 | **Trabalho longo vai para a fila**, nunca inline no webhook. | `src/lib/fila/` |

## 3. Regras por domínio

### Reservas, preço e saldo
Toda a regra vive em `src/lib/reservas/`. A tela e a Hígia **chamam** essas funções — não recalculam.
Se você está escrevendo a mesma conta numa server action e num componente, pare.

Cada um destes tem teste, e o teste é o contrato: `preco.test.ts`, `credito.test.ts`,
`disponibilidade.test.ts`, `horario.test.ts`, `sala-routing.test.ts`.

### A Hígia (agente de WhatsApp)
- Persona e limites: `src/lib/agente/prompt-base.ts` + `montar-prompt.ts`.
- Capacidade nova = **ferramenta** em `ferramentas-defs.ts` **e** implementação em `ferramentas.ts`.
  As duas pontas, sempre.
- Texto padrão fica em `mensagens-padrao.ts`, não espalhado no prompt.
- Depois de mexer, rode o simulador: `npm run sim`.

### Fila
`src/lib/fila/` (BullMQ + Redis). Job idempotente: reprocessar não pode cobrar duas vezes nem
duplicar reserva. O webhook **enfileira e devolve** — não processa.

### Banco
- **Drizzle + PostgreSQL**, como manda a estrutura base. Nunca Prisma, nunca SQLite.
- Toda tabela tem as colunas de auditoria e `is_deleted` / `deleted_at`.
- Migração: `npm run db:generate` + `npm run db:migrate`. Nunca edite migração aplicada.

### LGPD
`src/lib/db/schema/lgpd.ts` (`lgpd_solicitacoes`, `lgpd_config`, `clientes_consentimentos`).
Consentimento e solicitação de exclusão têm fluxo próprio — não apague dado por fora dele.

### Segurança
- Nunca logue telefone, CPF, e-mail ou valor de cliente em texto claro.
- Nunca comite `.env` nem credencial de WhatsApp / Google / MinIO.

## 4. Comandos

```bash
npm run dev
npm run build
npm run typecheck
npm run lint
npm test
npm run sim            # simulador da Higia
npm run worker         # worker da fila
npm run db:generate
npm run db:migrate
npm run db:studio
npm run compliance     # auditor da estrutura base
npm run map            # mapa do projeto
```

## 5. Checklist de saída

- [ ] Quais arquivos foram lidos antes de alterar
- [ ] Quais invariantes da seção 2 a mudança toca
- [ ] Saída de `npm test` e `npm run typecheck`
- [ ] Saída de `npm run compliance` (tem que passar — é a regra da base)
- [ ] Se mexeu na Hígia: o que o `npm run sim` mostrou
- [ ] Riscos residuais e o que ficou fora do escopo
