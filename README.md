# Espaço Flow

Sistema de gestão do coworking Espaço Flow: salas, reservas, pacotes de horas, crédito em reais,
pagamentos e a **Hígia** — agente de WhatsApp que atende o cliente, consulta disponibilidade e
reserva sozinha.

```
CLIENTE ──WhatsApp──> webhook ──> fila (BullMQ/Redis) ──> HÍGIA (agente + ferramentas)
                                                              │
                                        ┌─────────────────────┼──────────────────┐
                                        ▼                     ▼                  ▼
                                  disponibilidade        saldo/pacote        reserva
                                   (salas/horários)      (crédito R$)        + Google Agenda
PAINEL (equipe) ──> as mesmas regras de src/lib/, nunca duplicadas na tela
```

## Stack

Next.js (App Router) · TypeScript strict · **Drizzle ORM + PostgreSQL 16** · **BullMQ + Redis** ·
MongoDB · MinIO/S3 · pdf-lib · Google Agenda (OAuth) · WhatsApp · Tailwind + shadcn/Radix ·
react-hook-form + Zod · Vitest.

Segue as regras absolutas da [estrutura base](../CLAUDE.md): Drizzle (nunca Prisma), PostgreSQL
(nunca SQLite), soft delete, colunas de auditoria, optimistic locking.

## Setup

```bash
npm install
docker compose up -d          # PostgreSQL 16 na porta 5433 + Redis
cp .env.example .env          # preencher (ver abaixo)
npm run db:migrate
npm run db:seed
npm run dev                   # http://localhost:3000
npm run worker                # em outro terminal: worker da fila
```

> O PostgreSQL sobe na porta **5433** — a 5432 já é usada por um Postgres nativo nesta máquina.

Variáveis de ambiente, por grupo:

| Grupo | Variáveis |
|---|---|
| App | `APP_URL`, `APP_VERSION`, `NODE_ENV` |
| Banco | `DATABASE_URL` |
| Fila | `REDIS_URL`, `FILA_HABILITADA` |
| Mongo | `MONGO_URL` |
| Reservas | `HOLD_TTL_MIN` |
| Agente | `ANTHROPIC_API_KEY` |
| WhatsApp | `WHATSAPP_PROVIDER`, `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_INSTANCIA`, `WHATSAPP_WEBHOOK_URL` |
| Google | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GOOGLE_CADASTRO_SHEET_ID`, `GOOGLE_CADASTRO_SHEET_GID` |
| MinIO | `MINIO_ENDPOINT`, `MINIO_PORT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_USE_SSL`, `MINIO_PUBLIC_URL` |
| Seed | `SEED_OWNER_EMAIL`, `SEED_OWNER_SENHA` |
| Simulador | `SIM_NOME`, `SIM_TELEFONE` |

> Nunca comite `.env` nem credencial de WhatsApp, Google ou MinIO.

## Comandos

```bash
npm run dev            # desenvolvimento
npm run build          # build de producao
npm run typecheck      # tsc --noEmit
npm run lint
npm test               # Vitest
npm run sim            # simulador da Higia (conversa de ponta a ponta)
npm run worker         # worker da fila BullMQ
npm run db:generate    # gera migracao a partir do schema Drizzle
npm run db:migrate
npm run db:push
npm run db:studio
npm run db:seed
npm run compliance     # auditor da estrutura base
npm run map            # mapa do projeto
```

## Estrutura

```
src/
  app/
    (auth)/login/
    (dashboard)/        # clientes, reservas, salas, pacotes, pagamentos, conversas,
                        # agente, midia, relatorios, painel-owner, configuracoes
    api/                # whatsapp/webhook, google/oauth, health
  lib/
    db/schema/          # 15 arquivos de schema Drizzle
    actions/            # 18 server actions — as regras de negocio ficam aqui
    reservas/           # agendar, disponibilidade, preco, credito, pacote-saldo, holds,
                        # sala-routing, sala-preferencia, titular, agente-recorrente
    agente/             # prompt-base, montar-prompt, ferramentas, mensagens-padrao, onboarding
    fila/               # BullMQ: conexao, filas, dispatch, worker
    whatsapp/  google/  storage/  documentos/  mongo/  auth/  audit/  validators/
  scripts/              # simular-higia, dedup-clientes, verificar-identidade, sync-clientes-planilha
docs/
```

## Documentação

| Documento | Conteúdo |
|---|---|
| [docs/architecture.md](docs/architecture.md) | Mapa, fontes de verdade, **invariantes críticos**, anti-padrões |
| [../CLAUDE.md](../CLAUDE.md) | Regras absolutas da estrutura base |

### Para agentes de IA

| Arquivo | Para quem |
|---|---|
| [CLAUDE.md](CLAUDE.md) | Claude Code |
| [AGENTS.md](AGENTS.md) | Codex, Cursor, Copilot e agentes genéricos |
| [.agents/rules/espaco-flow.md](.agents/rules/espaco-flow.md) | Antigravity — regras do workspace |
| [.agents/workflows/bugfix.md](.agents/workflows/bugfix.md) · [.agents/workflows/feature.md](.agents/workflows/feature.md) | Passo a passo por tipo de tarefa |
| `.claude/skills/how-to-use-guide/` | Skill que gera guia "como usar" em PDF para o cliente |

**Antes de mexer em crédito, saldo, horário ou na Hígia, leia `docs/architecture.md`.** Cada limite
ali tem um incidente de produção atrás.
