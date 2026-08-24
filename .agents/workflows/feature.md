# Workflow — nova funcionalidade no Espaço Flow

## 1. Ler antes de projetar

- `docs/architecture.md` — seções 3 (estrutura), 4 (fonte de verdade), 5 (invariantes)
- `../CLAUDE.md` — regras absolutas da estrutura base; elas valem aqui e são bloqueantes
- `src/lib/agente/prompt-base.ts` se a Hígia vai fazer algo novo

## 2. Decidir onde mora

| Tipo de mudança | Onde |
| :--- | :--- |
| Regra de reserva, preço, saldo, crédito | `src/lib/reservas/<assunto>.ts` — função pura sempre que der |
| Capacidade nova da Hígia | `src/lib/agente/ferramentas-defs.ts` **+** `ferramentas.ts` |
| Texto que a Hígia manda | `src/lib/agente/mensagens-padrao.ts` |
| Server action | `src/lib/actions/<dominio>.ts` |
| Tela | `src/app/(dashboard)/<rota>/` |
| Tabela ou coluna | `src/lib/db/schema/<dominio>.ts` + `npm run db:generate` + `npm run db:migrate` |
| Processamento assíncrono | `src/lib/fila/` (BullMQ) |
| Arquivo/documento | `src/lib/storage/`, `src/lib/documentos/` |

**Regra de negócio em um lugar só.** Se a tela e a Hígia precisam da mesma conta, as duas chamam a
mesma função em `src/lib/`.

## 3. Implementar respeitando a estrutura base

Isto é obrigatório aqui (`../CLAUDE.md`), não é preferência:

- Tabela nova tem `created_at`, `updated_at`, `deleted_at`, `is_deleted` e registro de quem alterou.
- FK com `ON DELETE RESTRICT` para dado crítico — nunca `CASCADE`.
- Nome de tabela hierárquico (`clientes`, `clientes_pacotes`, `clientes_pacotes_movimentos`).
- Delete é **lógico**; query padrão filtra `is_deleted = false`.
- Edição concorrente usa optimistic locking por `updated_at`.
- Ação crítica na tela usa o modal de confirmação com block de 3 segundos.
- Validação com Zod na borda.

E os invariantes deste projeto:
- Horário com offset `-03:00`.
- Crédito por entrada no ledger, nunca `UPDATE` de saldo.
- Job idempotente: reprocessar não cobra duas vezes nem duplica reserva.

## 4. Testar

```bash
npm run typecheck
npm test
npm run compliance
npm run sim          # se mexeu na Higia
```

Regra de dinheiro ou de horário entra com teste — isole a função pura, como já é feito em
`credito.ts` e `disponibilidade.ts`.

## 5. Documentar na mesma alteração

- Módulo, integração ou invariante novo → `docs/architecture.md` (seções 4 e 5)
- Invariante que os agentes precisam respeitar → `AGENTS.md` **e** `CLAUDE.md`
- Decisão de arquitetura → ADR em `../docs/adr/` da estrutura base

## 6. Reportar

Arquivos criados/alterados · invariantes tocados · saída de `npm test`, `npm run typecheck` e
`npm run compliance` · docs atualizados · o que ficou fora do escopo.
