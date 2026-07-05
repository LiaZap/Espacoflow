import { consultarDisponibilidadeAgente, agendarReservaAgente } from "@/lib/reservas/agendar";
import { calcularPrecoAvulsa, precoAvulsaDiaDetalhe } from "@/lib/reservas/preco";
import { pacoteAtivoDoCliente } from "@/lib/reservas/pacote-saldo";
import { saldoCreditoCliente } from "@/lib/reservas/credito";
import {
  listarReservasFuturasCliente,
  cancelarReservaAgente,
  alterarReservaAgente,
} from "@/lib/reservas/agente-recorrente";
import { registrarQualificacao, confirmarCadastroPlanilha } from "./onboarding";

/** Definições das ferramentas (formato tool use da Anthropic) que a Hígia pode chamar. */
export const FERRAMENTAS_AGENDA = [
  {
    name: "calcular_preco",
    description:
      "Calcula o valor TOTAL de reservas avulsas, somando POR DIA (cada dia separado). SEMPRE use esta ferramenta para informar qualquer valor — nunca calcule de cabeça. NÃO aplique pacotes (10h/20h/40h) aqui: pacote só quando o cliente já tem ou escolhe um.",
    input_schema: {
      type: "object",
      properties: {
        sessoes: {
          type: "array",
          description: "Uma entrada por sessão/uso. Sessões do mesmo dia são somadas automaticamente.",
          items: {
            type: "object",
            properties: {
              data: { type: "string", description: "Data da sessão (AAAA-MM-DD)" },
              horas: { type: "number", description: "Duração em horas (ex.: 1, 1.5, 2)" },
            },
            required: ["data", "horas"],
          },
        },
      },
      required: ["sessoes"],
    },
  },
  {
    name: "qualificar_cliente",
    description:
      "Registra a qualificação de perfil de um cliente NOVO. Chame UMA VEZ, depois de coletar as respostas e ANTES de informar preço ou agendar. Se precisa_maca=true ou pessoas>3, o cliente fica FORA do perfil (a ferramenta retorna a mensagem a enviar). NÃO chame para cliente recorrente.",
    input_schema: {
      type: "object",
      properties: {
        tipo_uso: { type: "string", description: "Tipo de uso (atendimento, reunião, mentoria, consultoria...)" },
        profissao: { type: "string", description: "Profissão/especialidade do cliente (ex.: psicólogo, advogado)" },
        pessoas: { type: "integer", description: "Quantas pessoas vão usar a sala (máximo 3)" },
        precisa_maca: {
          type: "boolean",
          description: "true se o cliente precisa de maca, procedimento corporal, licença sanitária ou endereço fiscal",
        },
      },
      required: ["pessoas", "precisa_maca"],
    },
  },
  {
    name: "confirmar_cadastro",
    description:
      "ÚNICA forma de registrar o aceite da política de um cliente NOVO: valida o cadastro lendo a planilha do formulário (casa pelo telefone). Use quando o cliente disser que preencheu o formulário. Se não encontrar, peça para ele confirmar o número de WhatsApp usado no formulário. O aceite NÃO pode ser registrado só porque o cliente diz 'aceito' no chat — ele precisa preencher o formulário.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "consultar_disponibilidade",
    description:
      "Verifica quais salas estão livres para uma data, horário e duração. SEMPRE use antes de oferecer ou marcar um horário — nunca afirme disponibilidade sem checar aqui.",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
        hora: { type: "string", description: "Hora de início no formato HH:MM (24h)" },
        duracao_min: {
          type: "integer",
          description: "Duração em minutos (mínimo 60, em múltiplos de 30)",
        },
      },
      required: ["data", "hora", "duracao_min"],
    },
  },
  {
    name: "agendar_reserva",
    description:
      "Cria uma reserva PROVISÓRIA (hold) para o cliente desta conversa, pendente de Pix. Chame UMA VEZ POR SESSÃO (cada horário/dia é uma reserva separada). Use depois de checar a disponibilidade e o cliente concordar. Para cliente NOVO, só funciona se você já tiver chamado qualificar_cliente e o cadastro/aceite já estiver confirmado (confirmar_cadastro). Se o cliente ESCOLHEU uma sala específica, informe em `sala`; senão o sistema escolhe pela necessidade de mesa. A confirmação é automática quando o cliente enviar o comprovante (não depende da equipe).",
    input_schema: {
      type: "object",
      properties: {
        data: { type: "string", description: "Data no formato AAAA-MM-DD" },
        hora: { type: "string", description: "Hora de início no formato HH:MM (24h)" },
        duracao_min: { type: "integer", description: "Duração em minutos (mínimo 60, múltiplos de 30)" },
        finalidade: {
          type: "string",
          description: "Para que o cliente vai usar a sala (ex.: atendimento, reunião, mentoria)",
        },
        sala: {
          type: "string",
          description:
            "Nome EXATO da sala que o cliente escolheu explicitamente (ex.: 'Sala 03' ou como veio em consultar_disponibilidade). Deixe vazio para o sistema escolher pela necessidade de mesa. Se o cliente pediu uma sala, a escolha dele TEM prioridade sobre a regra de mesa.",
        },
        precisa_mesa: {
          type: "boolean",
          description:
            "true se o cliente vai precisar de mesa/escrivaninha (ex.: apoio para notebook). false para terapia de conversa (psicólogo → Sala 02 sem mesa). Só é usado quando o cliente NÃO escolheu uma sala em `sala`. Pergunte ao cliente se não souber.",
        },
        usar_saldo: {
          type: "boolean",
          description:
            "true para pagar com o SALDO do pacote do cliente (recorrente com pacote ativo) — a reserva já fica confirmada, SEM Pix. Só use se a memória indicar pacote ativo e o cliente concordar em usar o saldo.",
        },
        valor: {
          type: "number",
          description:
            "Valor TOTAL combinado da reserva, em reais (conforme a tabela de preços). Usado para validar o comprovante de Pix. Ignorado quando usar_saldo=true.",
        },
      },
      required: ["data", "hora", "duracao_min"],
    },
  },
  {
    name: "consultar_saldo",
    description:
      "Consulta o saldo de pacote ativo do cliente desta conversa (horas restantes e validade). Use quando um cliente recorrente quiser reservar para saber se pode usar o saldo do pacote em vez de Pix.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "listar_minhas_reservas",
    description:
      "Lista as reservas FUTURAS do cliente desta conversa (id, sala, data, hora). Use antes de cancelar/alterar, para saber QUAL reserva o cliente quer mexer (e pegar o reserva_id).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "cancelar_reserva",
    description:
      "Cancela uma reserva do cliente desta conversa. Use o reserva_id de listar_minhas_reservas. Se o cancelamento for dentro do prazo e a reserva foi paga por pacote, as horas voltam ao saldo automaticamente.",
    input_schema: {
      type: "object",
      properties: {
        reserva_id: { type: "string", description: "ID da reserva a cancelar (de listar_minhas_reservas)" },
      },
      required: ["reserva_id"],
    },
  },
  {
    name: "alterar_reserva",
    description:
      "Remarca a data/hora E/OU troca a SALA de uma reserva do cliente (mantém a duração). Use o reserva_id de listar_minhas_reservas. Verifica disponibilidade/conflito antes de mover. Para só trocar de sala mantendo o horário, informe apenas nova_sala. VOCÊ resolve isso sozinha — nunca escale troca de sala para a equipe.",
    input_schema: {
      type: "object",
      properties: {
        reserva_id: { type: "string", description: "ID da reserva a alterar (de listar_minhas_reservas)" },
        nova_data: { type: "string", description: "Nova data AAAA-MM-DD (omita para manter a data atual)" },
        nova_hora: { type: "string", description: "Novo horário de início HH:MM 24h (omita para manter o horário atual)" },
        nova_sala: {
          type: "string",
          description: "Nome da sala destino (ex.: 'Sala 03') quando o cliente quer TROCAR de sala. Omita para manter a mesma sala.",
        },
      },
      required: ["reserva_id"],
    },
  },
] as const;

function num(v: unknown): number {
  return typeof v === "number" ? v : Number(String(v ?? ""));
}
function str(v: unknown): string {
  return typeof v === "string" ? v : String(v ?? "");
}
function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1 || v === "1";
}

/**
 * Executa uma ferramenta chamada pela Hígia e devolve o resultado (JSON string)
 * que volta para o modelo como tool_result. O `clienteId` é fixado pelo servidor.
 */
export async function executarFerramentaAgenda(
  nome: string,
  input: Record<string, unknown>,
  ctx: { clienteId: string }
): Promise<string> {
  try {
    if (nome === "calcular_preco") {
      const lista = Array.isArray(input.sessoes) ? (input.sessoes as Array<Record<string, unknown>>) : [];
      const sessoes = lista.map((s) => ({ data: str(s.data), horas: num(s.horas) }));
      if (sessoes.length === 0) return JSON.stringify({ ok: false, motivo: "sem sessões para calcular" });
      const r = calcularPrecoAvulsa(sessoes);
      if (!r.exato) {
        // Alguma duração não existe na tabela (ex.: 1h30) — NÃO inventar valor proporcional.
        const foraDaTabela = r.porDia
          .filter((d) => !d.exato)
          .map((d) => ({ data: d.data, horas: d.horas, opcoes: d.vizinhas ?? [] }));
        return JSON.stringify({
          ok: true,
          valor_exato: false,
          fora_da_tabela: foraDaTabela,
          instrucao:
            "Uma ou mais durações NÃO existem na tabela. NUNCA invente valor proporcional. Ofereça ao cliente as opções tabeladas mais próximas (ex.: '1h por R$40 ou 2h por R$65') e peça pra ele escolher uma delas.",
        });
      }
      return JSON.stringify({
        ok: true,
        valor_exato: true,
        total: r.total,
        por_dia: r.porDia,
        observacao:
          "Valores avulsos, calculados por dia. Informe o total e, se ajudar, o detalhe por dia. Não cite 'pacote' a menos que o cliente tenha/escolha um.",
      });
    }

    if (nome === "qualificar_cliente") {
      const r = await registrarQualificacao({
        clienteId: ctx.clienteId,
        tipoUso: input.tipo_uso != null ? str(input.tipo_uso) : undefined,
        profissao: input.profissao != null ? str(input.profissao) : undefined,
        pessoas: input.pessoas != null ? num(input.pessoas) : undefined,
        precisaMaca: bool(input.precisa_maca),
      });
      if (r.foraPerfil) {
        return JSON.stringify({
          ok: true,
          apto: false,
          fora_perfil: true,
          mensagem_para_o_cliente: r.mensagem,
          instrucao: "Cliente fora do perfil. Envie a mensagem acima com gentileza e NÃO informe preço nem agende.",
        });
      }
      if (!r.apto) return JSON.stringify({ ok: false, motivo: r.mensagem ?? "não foi possível qualificar" });
      return JSON.stringify({
        ok: true,
        apto: true,
        proximo_passo: "Cliente apto. Pode mostrar as fotos do espaço, informar o valor (calcular_preco) e seguir para o cadastro/aceite.",
      });
    }

    if (nome === "confirmar_cadastro") {
      const r = await confirmarCadastroPlanilha(ctx.clienteId);
      if (r.ok) {
        return JSON.stringify({
          ok: true,
          registrado: true,
          proximo_passo: "Cadastro e aceite confirmados pela planilha. Pode seguir para a disponibilidade e a reserva.",
        });
      }
      if (r.fallback) {
        // Planilha indisponível: NÃO registramos aceite sem prova (planilha é a prova).
        return JSON.stringify({
          ok: false,
          motivo: r.mensagem,
          instrucao:
            "Não consegui validar o cadastro agora. Peça ao cliente que confirme que preencheu o formulário com ESTE número de WhatsApp e tente confirmar_cadastro de novo. NÃO agende sem o cadastro validado.",
        });
      }
      return JSON.stringify({ ok: false, motivo: r.mensagem });
    }

    if (nome === "consultar_disponibilidade") {
      const r = await consultarDisponibilidadeAgente(str(input.data), str(input.hora), num(input.duracao_min));
      if (r.erro) return JSON.stringify({ ok: false, motivo: r.erro });
      const nomes = (r.livres ?? []).map((s) => s.nome);
      return JSON.stringify(
        nomes.length > 0
          ? { ok: true, disponivel: true, salas_livres: nomes }
          : { ok: true, disponivel: false, aviso: "Nenhuma sala livre nesse horário — ofereça outro." }
      );
    }

    if (nome === "agendar_reserva") {
      const duracaoMin = num(input.duracao_min);
      const usarSaldo = bool(input.usar_saldo);

      // A sala NÃO pode ser decidida silenciosamente: exige a escolha explícita do
      // cliente (sala) OU a resposta de "precisa de mesa?" antes de alocar.
      const temSala = input.sala != null && str(input.sala).trim().length > 0;
      const temMesa = input.precisa_mesa != null;
      if (!temSala && !temMesa) {
        return JSON.stringify({
          ok: false,
          motivo:
            "Antes de agendar, pergunte ao cliente se ele vai precisar de mesa/apoio para notebook (ou qual sala prefere). NÃO escolha a sala sozinha sem essa resposta.",
        });
      }

      // Pagamento por SALDO de pacote (recorrente): resolve o pacote ativo no servidor.
      let pacoteClienteId: string | undefined;
      if (usarSaldo) {
        const pac = await pacoteAtivoDoCliente(ctx.clienteId);
        if (!pac) {
          return JSON.stringify({ ok: false, motivo: "O cliente não tem pacote com saldo ativo — siga pelo Pix (avulsa)." });
        }
        pacoteClienteId = pac.id;
      }

      // Avulsa (Pix): só agenda durações que existem na tabela. 1h30 e afins → oferecer
      // as opções vizinhas, sem inventar valor proporcional (nem criar reserva sem preço).
      if (!usarSaldo) {
        const det = precoAvulsaDiaDetalhe(duracaoMin / 60);
        if (!det.exato) {
          const ops = (det.vizinhas ?? []).map((v) => `${v.horas}h por R$ ${v.valor}`).join(" ou ");
          return JSON.stringify({
            ok: false,
            motivo: `Essa duração não tem preço de tabela. Ofereça ao cliente: ${ops}. NÃO invente valor; peça pra ele escolher uma dessas durações e agende com ela.`,
          });
        }
      }

      let valor = input.valor != null ? num(input.valor) : undefined;
      if (!usarSaldo && (valor == null || valor <= 0)) {
        // Deriva o valor avulso no servidor quando o LLM não envia — sem isso o
        // pagamento nasce com valor null e TODA leitura de comprovante consta como
        // "divergente" no painel de inconsistências.
        const calc = calcularPrecoAvulsa([{ data: str(input.data), horas: duracaoMin / 60 }]);
        if (calc.total > 0) valor = calc.total;
      }

      const r = await agendarReservaAgente({
        clienteId: ctx.clienteId,
        data: str(input.data),
        hora: str(input.hora),
        duracaoMin,
        finalidade: input.finalidade ? str(input.finalidade) : undefined,
        salaNome: input.sala != null && str(input.sala).trim() ? str(input.sala).trim() : undefined,
        valor: usarSaldo ? undefined : valor,
        precisaMesa: input.precisa_mesa != null ? bool(input.precisa_mesa) : undefined,
        pacoteClienteId,
      });
      if ("erro" in r) return JSON.stringify({ ok: false, motivo: r.erro });

      const reservaInfo = { sala: r.salaNome, data: r.data, hora: r.hora, duracao_min: r.duracaoMin };

      if (r.viaPacote) {
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          pago_por: "pacote",
          saldo_restante: r.saldoApos,
          proximo_passo:
            "Reserva CONFIRMADA usando o saldo do pacote (NÃO peça Pix). Diga ao cliente que está confirmada e informe o saldo restante de horas.",
        });
      }
      if (r.viaCredito && r.jaPago) {
        // Crédito em R$ cobriu tudo → confirmada, sem Pix.
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          pago_por: "credito",
          credito_aplicado: r.creditoAplicado,
          proximo_passo:
            "Reserva CONFIRMADA usando o CRÉDITO do cliente (NÃO peça Pix). Diga que aplicou o crédito e confirme data, horário e sala.",
        });
      }
      if (r.viaCredito && !r.jaPago) {
        // Crédito cobriu em PARTE → cobrar por Pix APENAS a diferença.
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          pago_por: "credito_parcial",
          credito_aplicado: r.creditoAplicado,
          falta_pagar: r.diferenca,
          proximo_passo: `Apliquei R$ ${r.creditoAplicado} do crédito do cliente. Falta pagar R$ ${r.diferenca} por Pix: diga isso ao cliente, envie o Pix (marcador [PIX]) e peça o comprovante SÓ dessa diferença. Não peça o valor cheio.`,
        });
      }
      if (r.jaPago) {
        return JSON.stringify({
          ok: true,
          reserva: reservaInfo,
          proximo_passo: "Essa reserva já está confirmada/paga — NÃO peça Pix. Só confirme data, horário e sala ao cliente.",
        });
      }
      return JSON.stringify({
        ok: true,
        reserva: reservaInfo,
        proximo_passo:
          "Horário SEGURADO. Confirme ao cliente a DATA, o HORÁRIO e A SALA (use reserva.sala — sempre diga em qual sala ficou). Diga que você já segurou o horário dele (NÃO use a palavra 'provisória'). Depois de agendar TODAS as sessões pedidas, envie o Pix (marcador [PIX]) e peça o comprovante aqui. Quando o comprovante chegar, o sistema confirma tudo automaticamente — não diga que a equipe confirma nem que já está pago.",
      });
    }

    if (nome === "consultar_saldo") {
      const pac = await pacoteAtivoDoCliente(ctx.clienteId);
      const credito = await saldoCreditoCliente(ctx.clienteId);
      if (!pac && credito <= 0) {
        return JSON.stringify({
          ok: true,
          tem_saldo: false,
          credito_reais: 0,
          mensagem: "Cliente sem pacote ativo e sem crédito — a reserva é avulsa (Pix).",
        });
      }
      return JSON.stringify({
        ok: true,
        tem_saldo: !!pac,
        ...(pac ? { pacote: pac.pacoteNome, horas_saldo: pac.horasSaldo, valido_ate: pac.validoAte } : {}),
        credito_reais: credito,
        proximo_passo:
          credito > 0
            ? `O cliente tem R$ ${credito} de crédito — é aplicado AUTOMATICAMENTE ao agendar (cobre a reserva; se faltar, o resto vai por Pix). Não precisa pedir Pix se o crédito cobrir.${pac ? " Há também pacote de horas: ofereça usar o saldo com usar_saldo=true." : ""}`
            : "Ofereça usar o saldo do pacote; se o cliente topar, agende com usar_saldo=true (sem Pix).",
      });
    }

    if (nome === "listar_minhas_reservas") {
      const lista = await listarReservasFuturasCliente(ctx.clienteId);
      return JSON.stringify({
        ok: true,
        reservas: lista,
        ...(lista.length === 0 ? { aviso: "O cliente não tem reservas futuras." } : {}),
      });
    }

    if (nome === "cancelar_reserva") {
      const r = await cancelarReservaAgente(ctx.clienteId, str(input.reserva_id));
      if (r.erro) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({ ok: true, mensagem_para_o_cliente: r.mensagem, horas_creditadas: r.horasCreditadas });
    }

    if (nome === "alterar_reserva") {
      const r = await alterarReservaAgente(ctx.clienteId, str(input.reserva_id), {
        novaData: input.nova_data != null && str(input.nova_data).trim() ? str(input.nova_data).trim() : undefined,
        novaHora: input.nova_hora != null && str(input.nova_hora).trim() ? str(input.nova_hora).trim() : undefined,
        novaSalaNome: input.nova_sala != null && str(input.nova_sala).trim() ? str(input.nova_sala).trim() : undefined,
      });
      if (r.erro) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({ ok: true, mensagem_para_o_cliente: r.mensagem });
    }

    return JSON.stringify({ ok: false, motivo: "ferramenta desconhecida" });
  } catch {
    return JSON.stringify({ ok: false, motivo: "erro interno ao executar a ferramenta" });
  }
}
