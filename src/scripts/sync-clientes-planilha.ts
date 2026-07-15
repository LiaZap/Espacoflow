/**
 * Sincroniza os clientes com a PLANILHA de cadastro (regra "só é cliente quem está na
 * planilha"): faz SOFT DELETE dos clientes geridos pela planilha (origem "importado" ou
 * status "cliente") que NÃO aparecem mais na planilha atual — some das Reservas.
 *
 * TRAVAS DE SEGURANÇA (nunca perder dado/dinheiro):
 *  - aborta se a planilha vier VAZIA/não configurada (senão removeria todo mundo);
 *  - NUNCA remove quem tem SALDO (pacote ativo ou crédito > 0) — dinheiro;
 *  - NUNCA remove quem tem RESERVA FUTURA (confirmada/pendente) — compromisso marcado.
 * O resto é reversível (soft delete + auditoria). DRY-RUN por padrão; --apply efetiva.
 * Rodar em HML com backup ANTES de PRD. Uso:
 *   npx tsx src/scripts/sync-clientes-planilha.ts            # relatório
 *   npx tsx src/scripts/sync-clientes-planilha.ts --apply    # efetiva
 *
 * ponytail: casa por telefone canônico; assume que a planilha é a fonte de verdade dos
 * clientes. Guarda de dinheiro/reserva-futura evita apagar cliente real por engano.
 */
import "dotenv/config";
import { and, eq, gt, inArray, or, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, clientesAnotacoes, clientesConsentimentos } from "@/lib/db/schema/clientes";
import { clientesPacotes, clientesCreditos } from "@/lib/db/schema/pacotes";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { whatsappConversas } from "@/lib/db/schema/whatsapp";
import { registrarAuditoria } from "@/lib/audit/logger";
import { canonicalTelefoneBR } from "@/lib/whatsapp/telefone";
import { lerCadastros, cadastroSheetConfigurado } from "@/lib/google/cadastro-sheet";
import { pacoteAtivoDoCliente } from "@/lib/reservas/pacote-saldo";
import { saldoCreditoCliente } from "@/lib/reservas/credito";

const CLI_FK = [reservas, whatsappConversas, clientesPacotes, clientesCreditos, pagamentos, clientesAnotacoes, clientesConsentimentos];

async function main() {
  const apply = process.argv.includes("--apply");
  if (!cadastroSheetConfigurado()) {
    console.log("\x1b[31mPlanilha de cadastro não configurada (GOOGLE_CADASTRO_SHEET_ID). Abortando.\x1b[0m");
    process.exit(1);
  }
  const planilha = await lerCadastros();
  if (planilha.length === 0) {
    console.log("\x1b[31mPlanilha vazia (ou sem acesso). Abortando — não remove ninguém.\x1b[0m");
    process.exit(1);
  }
  const naPlanilha = new Set(planilha.map((c) => canonicalTelefoneBR(c.telefone)));

  // Clientes geridos pela planilha (importado OU já promovidos a "cliente"), ativos.
  const geridos = await db
    .select({ id: clientes.id, nome: clientes.nome, telefone: clientes.telefone, origem: clientes.origem, status_lead: clientes.status_lead })
    .from(clientes)
    .where(and(eq(clientes.is_deleted, false), or(eq(clientes.origem, "importado"), eq(clientes.status_lead, "cliente"))));
  const ausentes = geridos.filter((c) => !naPlanilha.has(canonicalTelefoneBR(c.telefone)));

  console.log(`\nPlanilha: ${planilha.length} cadastros | geridos ativos: ${geridos.length} | ausentes da planilha: ${ausentes.length}.${apply ? " [APLICANDO]" : " [DRY-RUN]"}\n`);
  const agora = new Date();
  let removidos = 0;
  for (const c of ausentes) {
    const temSaldoPacote = !!(await pacoteAtivoDoCliente(c.id));
    const temCredito = (await saldoCreditoCliente(c.id)) > 0;
    const [futura] = await db
      .select({ id: reservas.id })
      .from(reservas)
      .where(and(eq(reservas.cliente_id, c.id), eq(reservas.is_deleted, false), inArray(reservas.status_reserva, ["confirmada", "pendente"]), gt(reservas.inicio_em, agora)))
      .limit(1);
    if (temSaldoPacote || temCredito || futura) {
      console.log(`  \x1b[33m⊘ protegido\x1b[0m ${c.nome} (${c.telefone}) — ${temSaldoPacote ? "pacote ativo " : ""}${temCredito ? "crédito " : ""}${futura ? "reserva futura" : ""}`.trimEnd());
      continue;
    }
    console.log(`  \x1b[31m✗ remove\x1b[0m ${c.nome} (${c.telefone}) [${c.status_lead}/${c.origem}]`);
    if (!apply) continue;

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${canonicalTelefoneBR(c.telefone)}))`);
      const soft = { is_deleted: true, deleted_at: agora, updated_at: agora };
      for (const t of CLI_FK) await tx.update(t).set(soft).where(eq(t.cliente_id, c.id));
      await tx.update(clientes).set({ is_deleted: true, deleted_at: agora }).where(eq(clientes.id, c.id));
    });
    await registrarAuditoria({ acao: "excluir", entidade: "clientes", registroId: c.id, detalhes: `Sync planilha: removido (soft) — não está mais na planilha de cadastro (${c.telefone}).` }).catch(() => undefined);
    removidos += 1;
  }
  console.log(`\n${apply ? `Removidos ${removidos} cliente(s).` : "Nada alterado (dry-run). Rode com --apply para efetivar."}\n`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
