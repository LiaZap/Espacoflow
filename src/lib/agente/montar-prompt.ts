import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig, agentePrecos, agenteBaseConhecimento, agenteMidia } from "@/lib/db/schema/agente";
import { clientes } from "@/lib/db/schema/clientes";
import { reservas } from "@/lib/db/schema/reservas";
import { obterMemoria } from "@/lib/mongo/client";
import { pacoteAtivoDoCliente } from "@/lib/reservas/pacote-saldo";
import { saldoCreditoCliente } from "@/lib/reservas/credito";
import { slugMidia } from "@/lib/whatsapp/midia-marcadores";
import { formatarBRL } from "@/lib/utils";
import { PROMPT_BASE_HIGIA } from "./prompt-base";
import { DEFAULT_BOAS_VINDAS_NOVO, DEFAULT_FORA_PERFIL } from "./mensagens-padrao";

/**
 * Monta o prompt da Hígia em runtime, injetando persona (config) + preços + base
 * de conhecimento (tabelas = fonte única auditável). Nunca embute secrets.
 * Com `opts.clienteId`, injeta a memória do cliente (perfil + notas anteriores).
 */
export async function montarPromptHigia(opts?: {
  clienteId?: string;
  agendamento?: boolean;
}): Promise<string> {
  const [config] = await db
    .select()
    .from(agenteConfig)
    .where(eq(agenteConfig.is_deleted, false))
    .limit(1);

  const precos = await db
    .select()
    .from(agentePrecos)
    .where(and(eq(agentePrecos.is_deleted, false), eq(agentePrecos.ativo, true)))
    .orderBy(asc(agentePrecos.ordem));

  const base = await db
    .select()
    .from(agenteBaseConhecimento)
    .where(and(eq(agenteBaseConhecimento.is_deleted, false), eq(agenteBaseConhecimento.ativo, true)))
    .orderBy(asc(agenteBaseConhecimento.prioridade));

  const persona = config?.prompt_sistema?.trim() || PROMPT_BASE_HIGIA;

  // 2h/4h NÃO são pacote (são avulsa por dia). Relabela mesmo que a tabela traga
  // rótulo antigo, para a Hígia nunca apresentar isso como "pacote".
  const rotularPreco = (desc: string, uni: string): { desc: string; uni: string } => {
    const t = desc.trim();
    if (/pacote\s*(de\s*)?2\s*h|^2\s*horas?/i.test(t)) return { desc: "2 horas", uni: "no dia" };
    if (/pacote\s*(de\s*)?4\s*h|meia di[áa]ria|per[íi]odo de 4/i.test(t))
      return { desc: "Período de 4h (meia diária)", uni: "no dia" };
    return { desc: t, uni };
  };
  const precosTxt =
    precos.length > 0
      ? "Avulsa com desconto progressivo no MESMO dia (use a ferramenta calcular_preco para o total). " +
        "Pacotes de SALDO são só 10h/20h/40h. NUNCA chame 2h/4h de \"pacote\".\n" +
        precos
          .map((p) => {
            const r = rotularPreco(p.descricao, p.unidade ?? "");
            return `- ${r.desc}: ${formatarBRL(Math.round(Number(p.valor) * 100))}${r.uni ? ` / ${r.uni}` : ""}`;
          })
          .join("\n")
      : "(consultar base atualizada antes de informar)";

  const baseTxt =
    base.length > 0
      ? base.map((b) => `- [${b.categoria}] ${b.titulo}: ${b.conteudo}`).join("\n")
      : "(sem itens cadastrados)";

  const horario =
    config?.hora_inicio && config?.hora_fim
      ? `${config.hora_inicio.slice(0, 5)}h às ${config.hora_fim.slice(0, 5)}h`
      : "07h às 23h";

  // Saudação pelo horário atual em SP (Bom dia 06–11h59 / Boa tarde 12–17h59 / Boa noite 18–05h59).
  const tz = config?.timezone ?? "America/Sao_Paulo";
  const horaSP = Number(new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hour12: false }).format(new Date()));
  const saudacao = horaSP >= 6 && horaSP < 12 ? "Bom dia" : horaSP >= 12 && horaSP < 18 ? "Boa tarde" : "Boa noite";

  const prompt = persona
    .replaceAll("{{NOME_AGENTE}}", config?.nome_agente ?? "Hígia")
    .replaceAll("{{NOME_ESPACO}}", config?.nome_espaco ?? "Espaço Flow")
    .replaceAll("{{HORARIO}}", horario)
    .replaceAll("{{SAUDACAO}}", saudacao)
    .replaceAll("{{MSG_BOAS_VINDAS_NOVO}}", config?.msg_boas_vindas_novo?.trim() || DEFAULT_BOAS_VINDAS_NOVO)
    .replaceAll("{{MSG_FORA_PERFIL}}", config?.msg_fora_perfil?.trim() || DEFAULT_FORA_PERFIL)
    .replaceAll("{{PRECOS}}", precosTxt)
    .replaceAll("{{BASE_CONHECIMENTO}}", baseTxt)
    .replaceAll("{{DATA_HORA}}", new Date().toLocaleString("pt-BR", { timeZone: tz }));

  const pix = blocoPix(config);
  const midia = await blocoMidia();
  const memoria = opts?.clienteId ? await blocoMemoria(opts.clienteId) : "";
  const agenda = opts?.agendamento ? blocoAgendamento() : "";
  return prompt + agenda + pix + midia + memoria;
}

/** Instrui a Hígia a AGENDAR sozinha usando as ferramentas (tool use). */
function blocoAgendamento(): string {
  return `\n\n<agendamento_automatico>
Você pode AGENDAR sozinha, sem passar para um humano. Para CLIENTE NOVO, use as ferramentas nesta ordem (sem travar a conversa cedo):
1) "qualificar_cliente" — depois de coletar tipo de uso, profissão, nº de pessoas e se precisa de maca/procedimento. Se retornar fora_perfil, envie a mensagem devolvida e NÃO agende.
2) Mostre as fotos das salas ([FOTO: identificador]). Para a TABELA de valores (pergunta geral), escreva [TABELA] — o sistema manda a tabela completa (avulsa, meia diária, diária, pacotes e MENSAL FIXO) numa única mensagem; NÃO digite os valores nem omita o mensal. Para o total de uma reserva específica, use "calcular_preco".
3) "consultar_disponibilidade" (data AAAA-MM-DD, hora HH:MM, duração em min) e combine o horário. SEMPRE pergunte "precisa de mesa/apoio para notebook?" antes de agendar (a não ser que o cliente já tenha escolhido a sala) — nunca deixe o sistema escolher a sala sem essa resposta. Pode checar disponibilidade e informar preço SEM aceite.
4) Cadastro/aceite — SÓ depois de o cliente topar o horário: mande o link do formulário UMA vez. Quando ele disser que preencheu, chame "confirmar_cadastro" (valida na planilha pelo telefone). Achou + aceite → siga. Não achou → peça pra confirmar o número usado e tente de novo. O aceite SÓ vale pela planilha — NÃO existe registrar aceite pelo chat; sem cadastro validado, NÃO agende. NÃO reenvie o link à toa.
5) "agendar_reserva" — UMA VEZ POR SESSÃO. Se o cliente escolheu uma sala, passe o nome no campo "sala" (a escolha dele vence a regra de mesa). Senão, preencha precisa_mesa (true se precisa de mesa/apoio p/ notebook; false para psicólogo de conversa → Sala 02 sem mesa). Ao segurar, confirme DATA, HORÁRIO e SALA (reserva.sala) e diga "já segurei o seu horário" — NUNCA use a palavra "provisória".
6) Depois de agendar TODAS, envie o Pix ([PIX]) e PEÇA o comprovante aqui. Diga que assim que ele chegar fica tudo certo por aqui — o sistema confirma TUDO automaticamente e avisa o cliente. NUNCA afirme você mesma que está "pago", "confirmado" ou "garantido".
CLIENTE RECORRENTE ("Cliente recorrente: sim" na memória): PULE os passos 1 e 4 (já foi qualificado e já aceitou a política). Se ele não disser logo o que quer, ofereça de forma natural: RESERVAR uma sala, CANCELAR ou ALTERAR uma reserva, ou TIRAR DÚVIDAS. Você resolve TUDO isso SOZINHA pelas ferramentas — NUNCA passe cancelamento/alteração/reserva/dúvida para a equipe.
- RESERVAR: se a memória mostrar "Pacote ativo", ofereça usar o saldo; se ele topar, agende com usar_saldo=true (fica CONFIRMADA na hora, SEM Pix, e informe o saldo restante). Se a memória mostrar "Crédito disponível", ele é aplicado AUTOMATICAMENTE ao agendar — se cobrir tudo, a reserva confirma sem Pix; se cobrir só em parte, cobre o Pix APENAS da diferença. NUNCA mande o cliente "combinar o crédito com a equipe". Sem pacote/crédito (ou saldo insuficiente), siga avulsa por Pix.
- CANCELAR: use "listar_minhas_reservas" para achar a reserva certa (confirme com o cliente qual é), depois "cancelar_reserva" com o reserva_id. Se voltar horas pro pacote, avise.
- ALTERAR/REMARCAR: "listar_minhas_reservas" → "alterar_reserva". Pode mudar data/hora (nova_data, nova_hora) E/OU trocar de sala (nova_sala, ex.: "Sala 03") — informe só o que muda. TROCA DE SALA você resolve sozinha, NUNCA escale.
- DÚVIDAS: responda direto (veja <duvidas_comuns>).
Se algum horário estiver indisponível ou der erro, ofereça outro — não force; agende os que der.
Use [HUMANO] só em exceções reais (reclamação grave, reembolso, nota fiscal, ou algo que as ferramentas realmente não resolvem). Reservar/cancelar/alterar/saldo/dúvida VOCÊ resolve — NÃO escale.
</agendamento_automatico>`;
}

/** Instrui a Hígia a usar o marcador [PIX] (o sistema injeta a chave correta). */
function blocoPix(config?: { pix_chave?: string | null } | null): string {
  if (!config?.pix_chave?.trim()) return "";
  return `\n\n<pagamento_pix>
Quando o cliente confirmar que vai pagar (ou pedir a chave Pix), escreva o marcador [PIX] sozinho numa linha — o sistema envia os dados do Pix automaticamente, com a chave correta. NUNCA escreva ou invente a chave Pix você mesma. Depois, peça o comprovante aqui no chat: ao recebê-lo, o sistema confirma a reserva automaticamente. Não afirme você mesma que o pagamento está confirmado.
</pagamento_pix>`;
}

/** Lista as fotos/arquivos que a Hígia pode ENVIAR, com os marcadores certos. */
async function blocoMidia(): Promise<string> {
  const itens = await db
    .select()
    .from(agenteMidia)
    .where(and(eq(agenteMidia.is_deleted, false), eq(agenteMidia.ativo, true)));
  if (itens.length === 0) return "";

  const linhas = itens.map((m) => {
    const id = slugMidia(m.tags || m.nome);
    const desc = m.descricao ? ` — ${m.descricao}` : "";
    return `- ${id}: ${m.nome}${desc}`;
  });

  return `\n\n<midia_disponivel>
Você pode ENVIAR estas fotos/arquivos pelo WhatsApp. Para enviar um, escreva o marcador EXATAMENTE assim, sozinho numa linha: [FOTO: identificador]. Pode enviar vários (um marcador por linha).
Com CLIENTE NOVO, logo após qualificar (aprovado no perfil), ENVIE por conta própria 2 a 3 fotos das salas — sem o cliente precisar pedir. Envie o conjunto de fotos UMA ÚNICA vez por conversa: NÃO reenvie as mesmas fotos depois (mesmo que o cliente volte a perguntar das salas). Use SOMENTE os identificadores exatos listados abaixo; se não houver foto da sala ideal, descreva em texto e não prometa imagem que não existe.
NUNCA escreva a palavra "marcador", não cite o identificador em voz alta e não anuncie que vai mandar foto — apenas inclua o marcador e siga a conversa naturalmente.
Disponíveis (identificador: descrição):
${linhas.join("\n")}
</midia_disponivel>`;
}

/** Bloco de memória do cliente (perfil no Postgres + notas no Mongo). */
async function blocoMemoria(clienteId: string): Promise<string> {
  const [cli] = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.is_deleted, false)));
  if (!cli) return "";

  // Recorrente = já é cliente da base OU já teve reserva confirmada/concluída antes.
  // Sinaliza para a Hígia NÃO repetir a qualificação de perfil (maca etc.).
  const passadas = await db
    .select({ id: reservas.id })
    .from(reservas)
    .where(
      and(
        eq(reservas.cliente_id, clienteId),
        eq(reservas.is_deleted, false),
        inArray(reservas.status_reserva, ["confirmada", "concluida"])
      )
    )
    .limit(1);
  const recorrente = cli.status_lead === "cliente" || passadas.length > 0;

  const mem = await obterMemoria(clienteId).catch(() => null);
  const linhas: string[] = [
    `- Cliente recorrente: ${recorrente ? "sim" : "não"}`,
    `- Nome: ${cli.nome}${cli.nome_chamada ? ` (chamar de ${cli.nome_chamada})` : ""}`,
    `- Status do lead: ${cli.status_lead}`,
  ];
  if (cli.profissao) linhas.push(`- Profissão: ${cli.profissao}`);
  if (cli.interesses) linhas.push(`- Interesses: ${cli.interesses}`);
  if (cli.dores) linhas.push(`- Dores/necessidades: ${cli.dores}`);
  // Pacote ativo: a Hígia pode oferecer usar o saldo (sem Pix) ao reservar.
  const pacote = await pacoteAtivoDoCliente(clienteId).catch(() => null);
  if (pacote) {
    linhas.push(
      `- Pacote ativo: ${pacote.horasSaldo}h de saldo (válido até ${pacote.validoAte}). Ofereça usar o saldo na reserva (agendar com usar_saldo=true, sem Pix) se o cliente quiser.`
    );
  }
  // Crédito em R$ (ex.: de um cancelamento) — aplicado AUTOMATICAMENTE ao agendar.
  const credito = await saldoCreditoCliente(clienteId).catch(() => 0);
  if (credito > 0) {
    linhas.push(
      `- Crédito disponível: R$ ${credito}. É aplicado AUTOMATICAMENTE quando você agenda (agendar_reserva) — se cobrir a reserva, NÃO peça Pix; se cobrir só em parte, o sistema cobra o Pix só da diferença. Não mande o cliente "combinar com a equipe".`
    );
  }
  // Para cliente NOVO, sinaliza o que ainda falta no onboarding (o sistema bloqueia a
  // reserva sem isso). Recorrente já passou por tudo — não repetir.
  if (recorrente) {
    linhas.push("- Onboarding concluído (já qualificado e aceitou a política). NÃO requalifique nem peça aceite de novo.");
  } else {
    linhas.push(
      cli.perfil_qualificado_em
        ? "- Perfil já qualificado."
        : "- ⚠️ Ainda NÃO qualificado — use qualificar_cliente antes de agendar."
    );
    linhas.push(
      cli.aceitou_politica_em
        ? "- Já aceitou a política de uso."
        : "- ⚠️ Ainda NÃO aceitou a política — envie o formulário de cadastro e valide com confirmar_cadastro (aceite só vale pela planilha) antes de agendar."
    );
  }
  if (mem?.resumo) linhas.push(`- Notas anteriores: ${String(mem.resumo)}`);
  if (mem?.ultima_interacao) linhas.push(`- Última interação: ${String(mem.ultima_interacao)}`);

  return `\n\n<memoria_cliente>\nVocê já conhece este cliente — use para personalizar o atendimento (e confirme dados sensíveis quando necessário):\n${linhas.join("\n")}\n</memoria_cliente>`;
}
