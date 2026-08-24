# Arquitetura — Espaço Flow

> **Objetivo.** Mapa do sistema em uma leitura: o que existe, onde mora, o que não pode ser
> quebrado. Escrito a partir do código real (agosto/2026).

## 1. Visão geral

Sistema de gestão do coworking **Espaço Flow**: salas, reservas, pacotes de horas, crédito em reais,
pagamentos e um agente de WhatsApp — a **Hígia** — que atende o cliente, consulta disponibilidade e
reserva sozinha.

```
CLIENTE ──WhatsApp──> webhook ──> fila (BullMQ/Redis) ──> HÍGIA (agente + ferramentas)
                                                              │
                                        ┌─────────────────────┼──────────────────┐
                                        ▼                     ▼                  ▼
                                  disponibilidade        saldo/pacote        reserva
                                   (salas/horários)      (crédito R$)        + Google Agenda
PAINEL (equipe) ──> mesmas regras em src/lib/*, nunca duplicadas na tela
```

## 2. Stack

| Camada | Tecnologia |
| :--- | :--- |
| Framework | Next.js (App Router) · TypeScript strict |
| ORM | **Drizzle** sobre PostgreSQL (`postgres` driver) |
| Fila | **BullMQ** + Redis (`src/lib/fila/`) |
| Não relacional | MongoDB (`src/lib/mongo/`) |
| Arquivos | MinIO / S3 (`src/lib/storage/`) |
| Documentos | `pdf-lib` (`src/lib/documentos/`) |
| Integrações | Google Agenda (OAuth), WhatsApp |
| UI | Tailwind + shadcn/Radix · react-hook-form + Zod |
| Testes | Vitest (12 arquivos de teste) |
| Compliance | `npm run compliance` → `../scripts/check-compliance.mjs` da estrutura base |

Este projeto **segue o padrão da estrutura base**: Drizzle (não Prisma), PostgreSQL (não SQLite),
soft delete, colunas de auditoria. Ver `../CLAUDE.md`.

## 3. Estrutura

```
src/
  app/
    (auth)/login/
    (dashboard)/          # painel da equipe: clientes, reservas, salas, pacotes, pagamentos,
                          # conversas, agente, midia, relatorios, painel-owner, configuracoes
    api/                  # whatsapp/webhook, google/oauth, health
  lib/
    db/schema/            # 15 arquivos de schema Drizzle
    actions/              # 18 server actions — as regras de negocio vivem aqui
    reservas/             # agendar, disponibilidade, preco, credito, pacote-saldo, holds,
                          # sala-routing, sala-preferencia, titular, agente-recorrente
    agente/               # prompt-base, montar-prompt, ferramentas, ferramentas-defs,
                          # mensagens-padrao, onboarding
    fila/                 # conexao, filas, dispatch, worker (BullMQ)
    whatsapp/  google/  storage/  documentos/  mongo/  auth/  audit/  validators/
  scripts/                # simular-higia, dedup-clientes, verificar-identidade, sync-clientes-planilha
  test/
```

## 4. Arquivos fonte de verdade

| Assunto | Arquivo |
| :--- | :--- |
| Modelo de dados | `src/lib/db/schema/` (`clientes`, `salas`, `reservas`, `pacotes`, `pagamentos`, `agente`, `whatsapp`, `documentos`, `lgpd`, `auditoria`, `jobs`, `usuarios`, `convites`, `integracoes`) |
| Disponibilidade e janela de horário | `src/lib/reservas/disponibilidade.ts` |
| Preço | `src/lib/reservas/preco.ts` |
| **Crédito em reais** | `src/lib/reservas/credito.ts` |
| Saldo de pacote | `src/lib/reservas/pacote-saldo.ts` |
| Agendamento | `src/lib/reservas/agendar.ts`, `expirar-holds.ts` |
| Escolha de sala | `src/lib/reservas/sala-routing.ts`, `sala-preferencia.ts` |
| Titularidade do saldo | `src/lib/reservas/titular.ts` |
| Recorrência | `src/lib/reservas/agente-recorrente.ts` |
| Prompt da Hígia | `src/lib/agente/prompt-base.ts`, `montar-prompt.ts` |
| Ferramentas do agente | `src/lib/agente/ferramentas.ts`, `ferramentas-defs.ts` |
| Onboarding pelo WhatsApp | `src/lib/agente/onboarding.ts` |
| Fila | `src/lib/fila/filas.ts`, `dispatch.ts`, `worker.ts` |
| Auditoria | `src/lib/audit/` |

## 5. Invariantes críticos

1. **Fuso fixo `-03:00`.** O Brasil não usa horário de verão desde 2019, então a janela de reserva é
   calculada com offset fixo, não com o relógio do servidor. → `disponibilidade.ts`
2. **Crédito é ledger append-only.** `clientes_creditos` só recebe entradas; o saldo é
   `SUM(valor)` das entradas não expiradas, com **piso zero**. Nunca faça `UPDATE` de saldo.
   → `credito.ts`
3. **Crédito é tudo-ou-nada na reserva.** Se o crédito cobre, não sai Pix; se não cobre, a diferença
   vai por Pix. Não existe consumo parcial silencioso.
4. **Cancelamento dentro da política vira crédito com validade** — não devolve dinheiro.
   → `politica_cancelamento`
5. **Saldo tem titular.** Empresa com dois contatos autorizados consome **um** saldo só.
   → `titular.ts` (`idDoSaldo`)
6. **Identidade do cliente é o telefone canônico**, incluindo o caso do `0` de tronco. Dedup errado
   já criou grupo fantasma (commit `beddb04`). → `scripts/dedup-clientes.ts`
7. **Hold expira.** Reserva segurada e não confirmada é liberada. → `expirar-holds.ts`
8. **A Hígia não inventa.** Não inventa apelido do cliente, não inventa sala, não inventa preço —
   tudo vem de ferramenta (`ferramentas.ts`), não do texto do modelo.
9. **Eco da própria mensagem não pode calar a Hígia** — já aconteceu em produção (commit `40176e2`).
10. **Toda ação é auditada** (`src/lib/audit/`) e **delete é lógico** — padrão da estrutura base.
11. **Trabalho longo vai para a fila**, nunca inline no webhook. → `src/lib/fila/`

## 6. O que revisar antes de alterar

- Mexeu em preço, crédito, saldo, disponibilidade ou roteamento de sala? Rode `npm test` — cada um
  desses tem teste dedicado (`preco.test.ts`, `credito.test.ts`, `disponibilidade.test.ts`,
  `horario.test.ts`, `sala-routing.test.ts`, `onboarding.test.ts`).
- Mexeu na Hígia? Rode o simulador: `npm run sim` (`src/scripts/simular-higia.ts`).
- Mexeu no schema? `npm run db:generate` e `npm run db:migrate`.
- Antes de concluir: `npm run compliance` (auditor da estrutura base) e `npm run typecheck`.

## 7. Anti-padrões

- `UPDATE` em saldo de crédito em vez de nova entrada no ledger.
- Calcular horário com o relógio do servidor em vez do offset `-03:00`.
- Duplicar regra de reserva na tela em vez de chamar `src/lib/reservas/`.
- Deixar a Hígia responder sobre preço ou disponibilidade sem chamar a ferramenta.
- Processar mensagem de WhatsApp inline no webhook.
- Delete físico (viola a regra da estrutura base).
