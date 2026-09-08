/**
 * Validação DETERMINÍSTICA do R13 #2 (alterar duração recalcula saldo do pacote).
 * NÃO usa LLM nem passa pela trava de cadastro: cria cliente + pacote + reserva direto no
 * banco e chama alterarReservaAgente, conferindo o saldo. Faz SOFT DELETE do cliente de
 * teste no fim (telefone único por execução). Uso: npx tsx src/scripts/_validar-r13.ts
 * (throwaway — apagar o arquivo depois).
 */
import "dotenv/config";
import { and, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";
import { salas } from "@/lib/db/schema/salas";
import { pacotes, clientesPacotes } from "@/lib/db/schema/pacotes";
import { reservas } from "@/lib/db/schema/reservas";
import { alterarReservaAgente } from "@/lib/reservas/agente-recorrente";

const TEL = "5500" + String(Date.now()).slice(-9); // único por execução (evita colisão de UNIQUE)
let falhas = 0;
function check(nome: string, cond: boolean, detalhe = "") {
  console.log(`${cond ? "\x1b[32m✓ PASS\x1b[0m" : "\x1b[31m✗ FAIL\x1b[0m"} ${nome}${detalhe ? ` — ${detalhe}` : ""}`);
  if (!cond) falhas++;
}
async function saldoDoPacote(cpId: string): Promise<number> {
  const [cp] = await db.select({ s: clientesPacotes.horas_saldo }).from(clientesPacotes).where(eq(clientesPacotes.id, cpId));
  return Number(cp.s);
}
async function dadosReserva(rid: string) {
  const [rv] = await db.select({ d: reservas.duracao_min, h: reservas.horas_debitadas }).from(reservas).where(eq(reservas.id, rid));
  return { duracao: rv.d, horasDebitadas: Number(rv.h) };
}
function dataFutura(dias: number): string {
  return new Date(Date.now() + dias * 86_400_000).toISOString().slice(0, 10);
}
async function limparSoft(clienteId: string) {
  const agora = new Date();
  await db.update(reservas).set({ is_deleted: true, deleted_at: agora }).where(eq(reservas.cliente_id, clienteId));
  await db.update(clientesPacotes).set({ is_deleted: true, deleted_at: agora }).where(eq(clientesPacotes.cliente_id, clienteId));
  await db.update(clientes).set({ is_deleted: true, deleted_at: agora }).where(eq(clientes.id, clienteId));
}

async function main() {
  const [sala] = await db.select({ id: salas.id }).from(salas).where(and(eq(salas.is_deleted, false), eq(salas.ativa, true)));
  const [pac] = await db.select().from(pacotes).where(and(eq(pacotes.is_deleted, false), eq(pacotes.tipo, "pacote")));
  if (!sala || !pac) {
    console.log("\x1b[31mBanco sem sala ativa ou sem pacote no catálogo — rode o seed antes.\x1b[0m");
    process.exit(1);
  }

  // Cliente recorrente (pula a trava de cadastro; aqui só testamos alterar).
  const [cli] = await db
    .insert(clientes)
    .values({ nome: "Teste R13", telefone: TEL, status_lead: "cliente", perfil_qualificado_em: new Date(), aceitou_politica_em: new Date() })
    .returning();

  // Pacote 20h ATIVO, já com 3h consumidas (17h de saldo) — simula uma reserva de 3h já feita.
  const [cp] = await db
    .insert(clientesPacotes)
    .values({
      cliente_id: cli.id,
      pacote_id: pac.id,
      horas_total: "20",
      horas_consumidas: "3",
      horas_saldo: "17",
      valido_ate: dataFutura(90),
      status: "ativo",
    })
    .returning();

  // Reserva 3h paga pelo pacote (horas_debitadas=3), num horário FUTURO.
  const data = dataFutura(15);
  const [rv] = await db
    .insert(reservas)
    .values({
      sala_id: sala.id,
      cliente_id: cli.id,
      pacote_cliente_id: cp.id,
      data,
      hora: "10:00:00",
      duracao_min: 180,
      inicio_em: new Date(`${data}T13:00:00Z`),
      fim_em: new Date(`${data}T16:00:00Z`),
      status_reserva: "confirmada",
      status_pagamento: "pago",
      origem: "higia",
      horas_debitadas: "3",
    })
    .returning();

  console.log(`\nSetup: cliente ${cli.id.slice(0, 8)} | pacote 20h, saldo 17h | reserva 3h (${data} 10:00)\n`);

  // A — DIMINUIR 3h→2h → devolve 1h → saldo 18h.
  const a = await alterarReservaAgente(cli.id, rv.id, { novaDuracaoMin: 120 });
  const saldoA = await saldoDoPacote(cp.id);
  const rA = await dadosReserva(rv.id);
  check("A: alterar 3h→2h retorna ok", !!a.ok, a.erro ?? a.mensagem ?? "");
  check("A: saldo voltou p/ 18h", saldoA === 18, `saldo=${saldoA}`);
  check("A: reserva 120min / 2h debitadas", rA.duracao === 120 && rA.horasDebitadas === 2, `dur=${rA.duracao} deb=${rA.horasDebitadas}`);

  // B — AUMENTAR 2h→4h → debita +2h → saldo 16h.
  const b = await alterarReservaAgente(cli.id, rv.id, { novaDuracaoMin: 240 });
  const saldoB = await saldoDoPacote(cp.id);
  const rB = await dadosReserva(rv.id);
  check("B: alterar 2h→4h retorna ok", !!b.ok, b.erro ?? b.mensagem ?? "");
  check("B: saldo caiu p/ 16h", saldoB === 16, `saldo=${saldoB}`);
  check("B: reserva 240min / 4h debitadas", rB.duracao === 240 && rB.horasDebitadas === 4, `dur=${rB.duracao} deb=${rB.horasDebitadas}`);

  // C — SALDO INSUFICIENTE: zera saldo e tenta aumentar 4h→4h30 (+0,5h) → recusa, saldo intacto.
  await db.update(clientesPacotes).set({ horas_saldo: "0", status: "esgotado" }).where(eq(clientesPacotes.id, cp.id));
  const c = await alterarReservaAgente(cli.id, rv.id, { novaDuracaoMin: 270 });
  const saldoC = await saldoDoPacote(cp.id);
  const rC = await dadosReserva(rv.id);
  check("C: aumento sem saldo é RECUSADO", !!c.erro && !c.ok, c.erro ?? "sem erro (deveria recusar)");
  check("C: saldo intacto (0) e reserva não mudou (240min)", saldoC === 0 && rC.duracao === 240, `saldo=${saldoC} dur=${rC.duracao}`);

  // D — reserva AVULSA (sem pacote): mudar duração deve ser recusado (o valor muda).
  const dataD = dataFutura(16);
  const [rvAvulsa] = await db
    .insert(reservas)
    .values({
      sala_id: sala.id,
      cliente_id: cli.id,
      data: dataD,
      hora: "10:00:00",
      duracao_min: 60,
      inicio_em: new Date(`${dataD}T13:00:00Z`),
      fim_em: new Date(`${dataD}T14:00:00Z`),
      status_reserva: "confirmada",
      status_pagamento: "pago",
      origem: "higia",
    })
    .returning();
  const d = await alterarReservaAgente(cli.id, rvAvulsa.id, { novaDuracaoMin: 120 });
  const rD = await dadosReserva(rvAvulsa.id);
  check("D: mudar duração de avulsa é RECUSADO", !!d.erro && !d.ok, d.erro ?? "sem erro (deveria recusar)");
  check("D: reserva avulsa não mudou (60min)", rD.duracao === 60, `dur=${rD.duracao}`);

  // E — só remarcar HORÁRIO de avulsa deve continuar funcionando (não regrediu).
  const e = await alterarReservaAgente(cli.id, rvAvulsa.id, { novaHora: "11:00" });
  check("E: remarcar horário de avulsa ainda funciona", !!e.ok, e.erro ?? e.mensagem ?? "");

  await limparSoft(cli.id);
  console.log(`\n${falhas === 0 ? "\x1b[32m✓ TODOS OS CENÁRIOS PASSARAM\x1b[0m" : `\x1b[31m✗ ${falhas} verificação(ões) falharam\x1b[0m`}\n`);
  process.exit(falhas === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error("Erro na validação:", e);
  process.exit(1);
});
