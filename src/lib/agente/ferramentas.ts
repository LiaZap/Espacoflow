import { consultarDisponibilidadeAgente, agendarReservaAgente } from "@/lib/reservas/agendar";
import { calcularPrecoAvulsa } from "@/lib/reservas/preco";
import { registrarQualificacao, registrarAceitePolitica } from "./onboarding";

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
    name: "aceitar_politica",
    description:
      "Registra o aceite da política de uso (cadastro) do cliente. Chame quando o cliente confirmar que aceita a política (depois de você ter enviado o link do formulário de cadastro). É obrigatório para um cliente NOVO antes de agendar.",
    input_schema: {
      type: "object",
      properties: {
        concordo: { type: "boolean", description: "true quando o cliente confirma que aceita a política de uso" },
      },
      required: ["concordo"],
    },
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
      "Cria uma reserva PROVISÓRIA (hold) para o cliente desta conversa, pendente de Pix. Chame UMA VEZ POR SESSÃO (cada horário/dia é uma reserva separada). Use depois de checar a disponibilidade e o cliente concordar. Para cliente NOVO, só funciona se você já tiver chamado qualificar_cliente e aceitar_politica. O sistema escolhe a sala livre (respeitando precisa_mesa). A confirmação é automática quando o cliente enviar o comprovante (não depende da equipe).",
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
        precisa_mesa: {
          type: "boolean",
          description:
            "true se o cliente vai precisar de mesa/escrivaninha (ex.: apoio para notebook). false para terapia de conversa (psicólogo → Sala 02 sem mesa). Pergunte ao cliente se não souber.",
        },
        valor: {
          type: "number",
          description:
            "Valor TOTAL combinado da reserva, em reais (conforme a tabela de preços). Usado para validar o comprovante de Pix do cliente.",
        },
      },
      required: ["data", "hora", "duracao_min"],
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
      return JSON.stringify({
        ok: true,
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

    if (nome === "aceitar_politica") {
      const r = await registrarAceitePolitica({ clienteId: ctx.clienteId, concordo: bool(input.concordo) });
      if (!r.ok) return JSON.stringify({ ok: false, motivo: r.mensagem });
      return JSON.stringify({ ok: true, registrado: true, proximo_passo: "Aceite registrado. Pode seguir para a reserva e o Pix." });
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
      let valor = input.valor != null ? num(input.valor) : undefined;
      if (valor == null) {
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
        valor,
        precisaMesa: input.precisa_mesa != null ? bool(input.precisa_mesa) : undefined,
      });
      if ("erro" in r) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({
        ok: true,
        reserva: { sala: r.salaNome, data: r.data, hora: r.hora, duracao_min: r.duracaoMin },
        proximo_passo:
          "Horário SEGURADO. Diga ao cliente que você já segurou o horário dele (NÃO use a palavra 'provisória'). Depois de agendar TODAS as sessões pedidas, envie o Pix (marcador [PIX]) e peça o comprovante aqui. Quando o comprovante chegar, o sistema confirma tudo automaticamente — não diga que a equipe confirma nem que já está pago.",
      });
    }

    return JSON.stringify({ ok: false, motivo: "ferramenta desconhecida" });
  } catch {
    return JSON.stringify({ ok: false, motivo: "erro interno ao executar a ferramenta" });
  }
}
