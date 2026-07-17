/**
 * PROVA ponta a ponta do fix de identidade (Bug 1: recorrente tratado como novo).
 * Reproduz o caso Vitória: cria um "cliente" recorrente COM saldo, telefone no formato COM o
 * 9º dígito (como veio da planilha); depois manda uma mensagem de WhatsApp com o MESMO número
 * SEM o 9º dígito e verifica que a ingestão resolveu para o MESMO cliente (não criou duplicado)
 * e que o saldo aparece. Se qualquer asserção falhar, o bug NÃO está corrigido.
 *
 * Uso (com Docker/HML de pé):  npx tsx src/scripts/verificar-identidade.ts
 * Escreve dados de teste e faz SOFT DELETE deles no fim.
 */
import "dotenv/config";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";
import { pacotes, clientesPacotes } from "@/lib/db/schema/pacotes";
import { whatsappConversas } from "@/lib/db/schema/whatsapp";
import { ingerirMensagemRecebida } from "@/lib/whatsapp/ingestao";
import { pacoteAtivoDoCliente } from "@/lib/reservas/pacote-saldo";
import { variantesTelefoneBR } from "@/lib/whatsapp/telefone";

let falhas = 0;
function assert(nome: string, cond: boolean, detalhe = "") {
  console.log(`${cond ? "\x1b[32m✓\x1b[0m" : "\x1b[31m✗\x1b[0m"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!cond) falhas++;
}
const dataFutura = (dias: number) => new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);

async function main() {
  const suf = String(Date.now()).slice(-4);
  const num8 = `8${suf}001`; // 8 dígitos, faixa de CELULAR (começa 8)
  const COM_NOVE = `5548${9}${num8}`; // planilha: 55+DDD+9+XXXXXXXX (13 díg.)
  const SEM_NOVE = `5548${num8}`; //          WhatsApp: 55+DDD+XXXXXXXX (12 díg.)

  // Limpa resquício de execução anterior (por variantes).
  const variantes = variantesTelefoneBR(COM_NOVE);
  await db.update(clientes).set({ is_deleted: true, deleted_at: new Date() }).where(inArray(clientes.telefone, variantes));

  const [pac] = await db.select().from(pacotes).where(and(eq(pacotes.is_deleted, false), eq(pacotes.tipo, "pacote")));
  if (!pac) {
    console.log("\x1b[31mBanco sem pacote no catálogo — rode o seed.\x1b[0m");
    process.exit(1);
  }

  // 1) Cliente RECORRENTE, telefone COM o 9º dígito, com saldo de pacote ativo.
  const [cli] = await db
    .insert(clientes)
    .values({ nome: "Vitória Teste", telefone: COM_NOVE, status_lead: "cliente", aceitou_politica_em: new Date(), perfil_qualificado_em: new Date() })
    .returning();
  await db.insert(clientesPacotes).values({
    cliente_id: cli.id,
    pacote_id: pac.id,
    horas_total: "20",
    horas_consumidas: "0",
    horas_saldo: "20",
    valido_ate: dataFutura(90),
    status: "ativo",
  });
  // 1b) DUPLICADO "novo" pré-fix: registro criado pelo WhatsApp com o telefone SEM o 9º dígito
  // (formato EXATO que o WhatsApp manda). É o que quebrava o Item 1 — o match exato o escolhia
  // em vez do "cliente". O fix deve IGNORAR este e resolver para o "cliente".
  const [dup] = await db
    .insert(clientes)
    .values({ nome: "Vitória (novo)", telefone: SEM_NOVE, status_lead: "novo", origem: "whatsapp" })
    .returning();
  console.log(`\nSetup: cliente ${cli.id.slice(0, 8)} (COM 9, "cliente", saldo 20h) + duplicado ${dup.id.slice(0, 8)} (SEM 9, "novo")\n`);

  // 2) Mensagem de WhatsApp com o MESMO número SEM o 9º dígito (bate EXATO no duplicado "novo").
  const r = await ingerirMensagemRecebida({
    telefone: SEM_NOVE,
    nome: "Vitória",
    texto: "oi, quero reservar",
    tipo: "text",
    idExterno: `verif-${suf}`,
    payload: { verificacao: true },
  });

  if (r.duplicada) {
    console.log("\x1b[31mMensagem veio como duplicada — idExterno colidiu, rode de novo.\x1b[0m");
    process.exit(1);
  }

  // 3) Provas.
  assert("resolveu para o registro 'cliente' (NÃO o duplicado 'novo')", r.conversa.cliente_id === cli.id, `conversa.cliente_id=${r.conversa.cliente_id?.slice(0, 8)} esperado=${cli.id.slice(0, 8)} (dup=${dup.id.slice(0, 8)})`);

  const ativos = await db
    .select({ id: clientes.id })
    .from(clientes)
    .where(and(inArray(clientes.telefone, variantesTelefoneBR(SEM_NOVE)), eq(clientes.is_deleted, false)));
  assert("NÃO criou um 3º registro (segue com os 2 pré-existentes)", ativos.length === 2, `encontrados=${ativos.length}`);

  const saldo = await pacoteAtivoDoCliente(cli.id);
  assert("saldo do recorrente é reconhecido", !!saldo && saldo.horasSaldo === 20, `saldo=${saldo?.horasSaldo ?? "nenhum"}`);

  // Cleanup (soft delete de tudo que foi criado, por variantes).
  const idsCli = ativos.map((c) => c.id).concat(cli.id);
  await db.update(whatsappConversas).set({ is_deleted: true, deleted_at: new Date() }).where(inArray(whatsappConversas.cliente_id, idsCli));
  await db.update(clientesPacotes).set({ is_deleted: true, deleted_at: new Date() }).where(inArray(clientesPacotes.cliente_id, idsCli));
  await db.update(clientes).set({ is_deleted: true, deleted_at: new Date() }).where(inArray(clientes.id, idsCli));

  console.log(`\n${falhas === 0 ? "\x1b[32m✓ IDENTIDADE OK — recorrente reconhecido, saldo achado, sem duplicado.\x1b[0m" : `\x1b[31m✗ ${falhas} falha(s) — o bug NÃO está corrigido.\x1b[0m`}\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => { console.error("Erro:", e); process.exit(1); });
