/**
 * Une clientes DUPLICADOS (mesma pessoa gravada 2x com telefone em formatos diferentes —
 * 55+DDD com/sem 9º dígito — antes do fix de identidade). Junta pelo telefone CANÔNICO,
 * escolhe o registro "vencedor" (o que é "cliente"/tem saldo, senão o mais antigo), move
 * TODAS as FKs dos perdedores para o vencedor e faz SOFT DELETE dos perdedores.
 *
 * DRY-RUN por padrão (só imprime o que faria). Para aplicar: `--apply`.
 * SEMPRE rodar em HML com backup ANTES de PRD (regra da base). Uso:
 *   npx tsx src/scripts/dedup-clientes.ts            # relatório (não muda nada)
 *   npx tsx src/scripts/dedup-clientes.ts --apply    # aplica o merge
 *   npx tsx src/scripts/dedup-clientes.ts --check     # self-check da regra de vencedor
 */
import "dotenv/config";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes, clientesAnotacoes, clientesConsentimentos } from "@/lib/db/schema/clientes";
import { clientesPacotes, clientesCreditos } from "@/lib/db/schema/pacotes";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { whatsappConversas } from "@/lib/db/schema/whatsapp";
import { registrarAuditoria } from "@/lib/audit/logger";
import { canonicalTelefoneBR } from "@/lib/whatsapp/telefone";

type Cli = { id: string; telefone: string; nome: string; status_lead: string; created_at: Date };

/** Vencedor do grupo: prioriza status "cliente" (tem saldo/recorrência), senão o mais antigo. */
function escolherVencedor(grupo: Cli[]): Cli {
  return (
    grupo.find((c) => c.status_lead === "cliente") ??
    [...grupo].sort((a, b) => a.created_at.getTime() - b.created_at.getTime())[0]
  );
}

/** Tabelas com cliente_id a REAPONTAR do perdedor para o vencedor (as FKs financeiras/histórico). */
const TABELAS = [reservas, whatsappConversas, clientesPacotes, clientesCreditos, pagamentos, clientesAnotacoes, clientesConsentimentos];

async function main() {
  const apply = process.argv.includes("--apply");
  const todos = (await db
    .select({ id: clientes.id, telefone: clientes.telefone, nome: clientes.nome, status_lead: clientes.status_lead, created_at: clientes.created_at })
    .from(clientes)
    .where(eq(clientes.is_deleted, false))) as Cli[];

  const grupos = new Map<string, Cli[]>();
  for (const c of todos) {
    const k = canonicalTelefoneBR(c.telefone);
    (grupos.get(k) ?? grupos.set(k, []).get(k)!).push(c);
  }
  const dups = [...grupos.values()].filter((g) => g.length > 1);

  console.log(`\n${dups.length} grupo(s) de duplicados por telefone canônico.${apply ? " [APLICANDO]" : " [DRY-RUN]"}\n`);
  let unidos = 0;
  for (const grupo of dups) {
    const vencedor = escolherVencedor(grupo);
    const perdedores = grupo.filter((c) => c.id !== vencedor.id);
    const ids = perdedores.map((c) => c.id);
    console.log(`• ${canonicalTelefoneBR(vencedor.telefone)} → mantém ${vencedor.nome} (${vencedor.status_lead}, ${vencedor.telefone}); une ${perdedores.map((p) => `${p.nome}/${p.telefone}`).join(", ")}`);
    if (!apply) continue;

    await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${canonicalTelefoneBR(vencedor.telefone)}))`);
      for (const t of TABELAS) {
        await tx.update(t).set({ cliente_id: vencedor.id, updated_at: new Date() }).where(inArray(t.cliente_id, ids));
      }
      await tx.update(clientes).set({ is_deleted: true, deleted_at: new Date() }).where(inArray(clientes.id, ids));
    });
    await registrarAuditoria({ acao: "atualizar", entidade: "clientes", registroId: vencedor.id, detalhes: `Merge de duplicados: uniu ${ids.length} registro(s) (${perdedores.map((p) => p.telefone).join(", ")}).` }).catch(() => undefined);
    unidos += ids.length;
  }
  console.log(`\n${apply ? `Unidos ${unidos} registro(s).` : "Nada alterado (dry-run). Rode com --apply para efetivar."}\n`);
  process.exit(0);
}

function check() {
  const base = { telefone: "5548996282932", nome: "x" };
  const g: Cli[] = [
    { id: "a", ...base, status_lead: "novo", created_at: new Date("2026-01-02") },
    { id: "b", ...base, status_lead: "cliente", created_at: new Date("2026-01-05") },
  ];
  if (escolherVencedor(g).id !== "b") throw new Error("vencedor deve ser o 'cliente'");
  const g2: Cli[] = [
    { id: "a", ...base, status_lead: "novo", created_at: new Date("2026-01-05") },
    { id: "b", ...base, status_lead: "novo", created_at: new Date("2026-01-02") },
  ];
  if (escolherVencedor(g2).id !== "b") throw new Error("sem 'cliente', vence o mais antigo");
  console.log("check OK");
  process.exit(0);
}

if (process.argv.includes("--check")) check();
else main().catch((e) => { console.error(e); process.exit(1); });
