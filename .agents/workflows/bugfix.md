# Workflow — corrigir bug no Espaço Flow

## 1. Ler antes de tocar

- `docs/architecture.md` — seções 4 (fonte de verdade), 5 (invariantes), 7 (anti-padrões)
- O cabeçalho do arquivo suspeito: `credito.ts` e `disponibilidade.ts` explicam a regra no topo
- O histórico daquele arquivo — a maioria dos limites veio de incidente em produção

## 2. Localizar a camada

| Sintoma | Comece por |
| :--- | :--- |
| Saldo/crédito errado | `src/lib/reservas/credito.ts`, `pacote-saldo.ts` (têm teste) |
| Cliente com dois cadastros / saldo dividido | `titular.ts`, `src/scripts/dedup-clientes.ts` — telefone canônico |
| Horário ou duração errada | `disponibilidade.ts` (offset `-03:00`), `horario.test.ts` |
| Preço errado | `preco.ts` (tem teste) |
| Sala errada na reserva | `sala-routing.ts`, `sala-preferencia.ts` |
| Reserva presa / sala bloqueada | `expirar-holds.ts` |
| Recorrente não gerou | `agente-recorrente.ts` |
| Hígia calou / respondeu errado | `prompt-base.ts`, `montar-prompt.ts`, `ferramentas.ts`, tratamento de eco no webhook |
| Mensagem não processou | fila: `src/lib/fila/worker.ts`, `dispatch.ts` |
| Evento não foi para a agenda | `src/lib/google/` |

## 3. Diagnosticar sem escrever

- Reproduza a conversa no simulador: `npm run sim`.
- Para saldo, leia o **ledger** (`clientes_creditos`) — a resposta está nas entradas, não num campo
  de saldo. Se você está procurando um campo de saldo, está no lugar errado.
- Confira a auditoria (`src/lib/audit/`): quem fez, o quê, quando.

## 4. Corrigir a causa

`grep` pelos chamadores antes de editar. A regra fica em `src/lib/reservas/` ou `src/lib/agente/` —
nunca na tela, nunca só na server action.

## 5. Provar

```bash
npm test
npm run typecheck
npm run compliance
npm run sim          # se mexeu na Higia
```

Bug de saldo, preço, horário ou roteamento entra com teste — esses módulos já têm suíte e as funções
puras foram isoladas justamente para isso.

## 6. Reportar

Sintoma × causa raiz · arquivos lidos e alterados · invariantes tocados · saída de `npm test`,
`npm run typecheck` e `npm run compliance` · risco residual.
