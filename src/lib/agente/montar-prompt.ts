import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { agenteConfig, agentePrecos, agenteBaseConhecimento, agenteMidia } from "@/lib/db/schema/agente";
import { clientes } from "@/lib/db/schema/clientes";
import { reservas } from "@/lib/db/schema/reservas";
import { obterMemoria } from "@/lib/mongo/client";
import { slugMidia } from "@/lib/whatsapp/midia-marcadores";
import { formatarBRL } from "@/lib/utils";
import { PROMPT_BASE_HIGIA } from "./prompt-base";

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

  const precosTxt =
    precos.length > 0
      ? precos
          .map((p, i) => `${i + 1}. ${p.descricao}: ${formatarBRL(Math.round(Number(p.valor) * 100))} / ${p.unidade}`)
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

  const prompt = persona
    .replaceAll("{{NOME_AGENTE}}", config?.nome_agente ?? "Hígia")
    .replaceAll("{{NOME_ESPACO}}", config?.nome_espaco ?? "Espaço Flow")
    .replaceAll("{{HORARIO}}", horario)
    .replaceAll("{{PRECOS}}", precosTxt)
    .replaceAll("{{BASE_CONHECIMENTO}}", baseTxt)
    .replaceAll(
      "{{DATA_HORA}}",
      new Date().toLocaleString("pt-BR", { timeZone: config?.timezone ?? "America/Sao_Paulo" })
    );

  const pix = blocoPix(config);
  const midia = await blocoMidia();
  const memoria = opts?.clienteId ? await blocoMemoria(opts.clienteId) : "";
  const agenda = opts?.agendamento ? blocoAgendamento() : "";
  return prompt + agenda + pix + midia + memoria;
}

/** Instrui a Hígia a AGENDAR sozinha usando as ferramentas (tool use). */
function blocoAgendamento(): string {
  return `\n\n<agendamento_automatico>
Você pode AGENDAR sozinha, sem passar para um humano. Use as ferramentas:
1) Para cada horário pedido, chame "consultar_disponibilidade" (data AAAA-MM-DD, hora HH:MM, duração em min) antes de afirmar que está livre. Nunca invente disponibilidade.
2) Para o VALOR, chame "calcular_preco" com TODAS as sessões (cada uma com data e horas). Ele soma POR DIA — dias diferentes nunca se misturam. Informe o total (e o detalhe por dia, se ajudar). Nunca calcule de cabeça nem cite "pacote" para reserva avulsa.
3) Com o cliente de acordo, chame "agendar_reserva" UMA VEZ POR SESSÃO (cada data/hora vira uma reserva). O sistema escolhe a sala livre. Ficam PROVISÓRIAS.
4) Depois de agendar TODAS, envie o Pix (marcador [PIX]) e PEÇA o comprovante aqui no chat. Diga que assim que o comprovante chegar as reservas ficam garantidas. NÃO afirme você mesma que está pago — o sistema confirma TUDO e avisa o cliente automaticamente.
5) Se algum horário estiver indisponível ou der erro, ofereça outro — não force; agende os que der.
Use [HUMANO] só em exceções (reclamação, reembolso, ALTERAR/CANCELAR uma reserva já existente, nota fiscal, fora do perfil, ou algo que as ferramentas não resolvem).
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
Envie só quando fizer sentido (o cliente quer conhecer/ver as salas, pediu fotos, está decidindo). Não despeje todas as fotos sem o cliente pedir.
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
  if (cli.interesses) linhas.push(`- Interesses: ${cli.interesses}`);
  if (cli.dores) linhas.push(`- Dores/necessidades: ${cli.dores}`);
  if (cli.aceitou_politica_em) linhas.push("- Já aceitou a política de uso.");
  if (mem?.resumo) linhas.push(`- Notas anteriores: ${String(mem.resumo)}`);
  if (mem?.ultima_interacao) linhas.push(`- Última interação: ${String(mem.ultima_interacao)}`);

  return `\n\n<memoria_cliente>\nVocê já conhece este cliente — use para personalizar o atendimento (e confirme dados sensíveis quando necessário):\n${linhas.join("\n")}\n</memoria_cliente>`;
}
