/**
 * Simulador da Hígia pelo TERMINAL (sem WhatsApp real).
 *
 * Roda o fluxo REAL (ingestão -> gerarRespostaHigia inline -> ferramentas -> banco),
 * mas força o provider "sandbox" (nada é enviado a um número de verdade). Útil para
 * testar a conversa, o agendamento, o comprovante e CONFERIR o horário gravado x exibido.
 *
 * Pré-requisitos: DATABASE_URL no .env, banco migrado (npm run db:migrate) e semeado
 * (npm run db:seed), ANTHROPIC_API_KEY no .env, e o agente ATIVO com "reserva via IA".
 *
 * Uso:
 *   npm run sim                          # roda um roteiro padrão (psicóloga, online)
 *   npm run sim -- "oi" "quero sexta 9h" "[comprovante]"   # mensagens próprias
 *   # COMPRA DE PACOTE (testa comprar_pacote → pendente → ativa no comprovante):
 *   npm run sim -- "oi" "sou psicólogo, atendimento de conversa" "1 pessoa" "quero comprar o pacote de 10h" "[comprovante]"
 *   SIM_TELEFONE=5511999990000 npm run sim
 *
 * Use "[comprovante]" como mensagem para simular o envio de uma imagem de comprovante.
 *
 * ATENÇÃO: escreve no banco apontado por DATABASE_URL (cria cliente/conversa/reserva).
 * Depois limpe pelo Painel Owner -> "Limpar dados de teste (WhatsApp)".
 */
import "dotenv/config";

// Força o provider sandbox (sem isso, com Evolution configurada, dispararia no número real).
delete process.env.WHATSAPP_API_URL;
delete process.env.WHATSAPP_API_TOKEN;

import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { clientes } from "@/lib/db/schema/clientes";
import { reservas } from "@/lib/db/schema/reservas";
import { pagamentos } from "@/lib/db/schema/pagamentos";
import { salas } from "@/lib/db/schema/salas";
import { clientesPacotes, clientesCreditos } from "@/lib/db/schema/pacotes";
import { pacotes } from "@/lib/db/schema/pacotes";
import { whatsappMensagens } from "@/lib/db/schema/whatsapp";
import { ingerirMensagemRecebida } from "@/lib/whatsapp/ingestao";
import { gerarRespostaHigia } from "@/lib/whatsapp/higia";
import { formatarDataHora } from "@/lib/utils";

const TELEFONE = (process.env.SIM_TELEFONE ?? "5511000009999").replace(/\D/g, "");
const NOME = process.env.SIM_NOME ?? "Cliente Teste (sim)";

const ROTEIRO_PADRAO = [
  "Oi, tudo bem? Sou psicóloga e queria alugar uma sala pra atender. Vocês têm internet pra atendimento online?",
  "É atendimento individual, só eu e o paciente",
  "Não uso maca, é só terapia de conversa",
  "Atendo online, então vou precisar de uma mesa pro notebook",
  "Queria sexta, 03/07, das 9h às 11h",
  "Aceito a política de uso", // libera a trava do cadastro/aceite
  "Isso, pode confirmar a reserva", // o "sim" final -> cria o hold (agendar_reserva)
  "[comprovante]", // agora existe pagamento pendente -> confirma + sincroniza + promove
];

async function msgsDaConversa(conversaId: string) {
  return db
    .select()
    .from(whatsappMensagens)
    .where(and(eq(whatsappMensagens.conversa_id, conversaId), eq(whatsappMensagens.is_deleted, false)))
    .orderBy(asc(whatsappMensagens.created_at));
}

async function enviar(texto: string): Promise<void> {
  const ehComprovante = texto.trim().toLowerCase() === "[comprovante]";
  const tipo = ehComprovante ? "image" : "text";
  const midiaUrl = ehComprovante ? "https://example.com/comprovante-pix-teste.jpg" : undefined;
  console.log("\n\x1b[36m👤 cliente:\x1b[0m", ehComprovante ? "[envia imagem do comprovante]" : texto);

  const idExterno = `sim-${Date.now()}`;
  const r = await ingerirMensagemRecebida({
    telefone: TELEFONE,
    nome: NOME,
    texto: ehComprovante ? undefined : texto,
    tipo,
    midiaUrl,
    idExterno,
    payload: { simulado: true },
  });
  if (r.duplicada) {
    console.log("  (mensagem duplicada — ignorada)");
    return;
  }

  const higiaAntes = (await msgsDaConversa(r.conversa.id)).filter((m) => m.origem !== "user").length;
  await gerarRespostaHigia(r.conversa.id);
  const todas = await msgsDaConversa(r.conversa.id);
  const novas = todas.filter((m) => m.origem !== "user").slice(higiaAntes);
  if (novas.length === 0) {
    console.log("  \x1b[33m(Hígia não respondeu — confira agente ATIVO, resposta automática e ANTHROPIC_API_KEY)\x1b[0m");
  }
  for (const m of novas) {
    console.log("\x1b[32m🤖 Hígia:\x1b[0m", m.conteudo ?? `[${m.tipo}${m.midia_url ? `: ${m.midia_url}` : ""}]`);
  }
}

async function relatorioReservas(): Promise<void> {
  const [cli] = await db
    .select()
    .from(clientes)
    .where(eq(clientes.telefone, TELEFONE))
    .orderBy(desc(clientes.created_at))
    .limit(1);
  if (!cli) {
    console.log("\nNenhum cliente criado.");
    return;
  }
  console.log("\n\x1b[1m=== Cliente ===\x1b[0m");
  console.log(`  ${cli.nome} | status_lead=${cli.status_lead} | profissão=${cli.profissao ?? "—"}`);
  console.log(`  qualificado=${cli.perfil_qualificado_em ? "sim" : "não"} | aceitou_política=${cli.aceitou_politica_em ? "sim" : "não"}`);

  const res = await db
    .select()
    .from(reservas)
    .where(and(eq(reservas.cliente_id, cli.id), eq(reservas.is_deleted, false)))
    .orderBy(desc(reservas.created_at));
  const mapaSalas = new Map((await db.select({ id: salas.id, nome: salas.nome }).from(salas)).map((s) => [s.id, s.nome]));

  console.log("\n\x1b[1m=== Reservas (confira horário GRAVADO x EXIBIDO) ===\x1b[0m");
  if (res.length === 0) console.log("  (nenhuma)");
  for (const r of res) {
    const sala = mapaSalas.get(r.sala_id) ?? "?";
    const exibido = r.inicio_em && r.fim_em ? `${formatarDataHora(r.inicio_em)} → ${formatarDataHora(r.fim_em)}` : "—";
    console.log(`  • ${sala} | status=${r.status_reserva}/${r.status_pagamento}`);
    console.log(`      campos: data=${r.data} hora=${r.hora} duração=${r.duracao_min}min`);
    console.log(`      inicio_em (UTC): ${r.inicio_em?.toISOString() ?? "—"}`);
    console.log(`      \x1b[1mEXIBIDO no App: ${exibido}\x1b[0m  (deve bater com o resumo enviado ao cliente)`);
  }

  const pgs = await db
    .select()
    .from(pagamentos)
    .where(and(eq(pagamentos.cliente_id, cli.id), eq(pagamentos.is_deleted, false)))
    .orderBy(desc(pagamentos.created_at));
  console.log("\n\x1b[1m=== Pagamentos ===\x1b[0m");
  if (pgs.length === 0) console.log("  (nenhum)");
  for (const p of pgs) {
    console.log(`  • R$ ${p.valor ?? "—"} | status=${p.status} | comprovante=${p.comprovante_recebido ? "sim" : "não"} | leitura_confere=${p.leitura_confere ?? "—"}`);
  }

  // Pacotes de horas do cliente (compra via comprar_pacote → pendente → ativa no comprovante).
  const pacs = await db
    .select({
      nome: pacotes.nome,
      saldo: clientesPacotes.horas_saldo,
      total: clientesPacotes.horas_total,
      status: clientesPacotes.status,
      valido: clientesPacotes.valido_ate,
    })
    .from(clientesPacotes)
    .innerJoin(pacotes, eq(clientesPacotes.pacote_id, pacotes.id))
    .where(and(eq(clientesPacotes.cliente_id, cli.id), eq(clientesPacotes.is_deleted, false)))
    .orderBy(desc(clientesPacotes.created_at));
  console.log("\n\x1b[1m=== Pacotes do cliente (saldo de horas) ===\x1b[0m");
  if (pacs.length === 0) console.log("  (nenhum)");
  for (const p of pacs) {
    console.log(`  • ${p.nome} | status=${p.status} | saldo=${p.saldo}h de ${p.total}h | válido até ${p.valido}`);
  }

  // Crédito em R$ (ledger) — de cancelamento ou concedido pela equipe.
  const creds = await db
    .select()
    .from(clientesCreditos)
    .where(and(eq(clientesCreditos.cliente_id, cli.id), eq(clientesCreditos.is_deleted, false)))
    .orderBy(desc(clientesCreditos.created_at));
  console.log("\n\x1b[1m=== Crédito em R$ (ledger) ===\x1b[0m");
  if (creds.length === 0) console.log("  (nenhum)");
  for (const c of creds) {
    const exp = c.expira_em ? new Date(c.expira_em).toISOString().slice(0, 10) : "—";
    console.log(`  • ${c.tipo} | R$ ${c.valor} | expira ${exp} | ${c.motivo ?? ""}`);
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const roteiro = args.length > 0 ? args : ROTEIRO_PADRAO;

  console.log("\x1b[1m── Simulador Hígia (sandbox, sem WhatsApp real) ──\x1b[0m");
  console.log(`Telefone de teste: ${TELEFONE}`);
  if (!process.env.ANTHROPIC_API_KEY) {
    console.log("\x1b[33m⚠ ANTHROPIC_API_KEY ausente — a Hígia não vai responder.\x1b[0m");
  }

  for (const msg of roteiro) {
    await enviar(msg);
  }
  await relatorioReservas();

  console.log("\n\x1b[2mLimpe os dados de teste depois no Painel Owner → \"Limpar dados de teste (WhatsApp)\".\x1b[0m");
  process.exit(0);
}

main().catch((e) => {
  console.error("Falha na simulação:", e);
  process.exit(1);
});
