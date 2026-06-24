import { consultarDisponibilidadeAgente, agendarReservaAgente } from "@/lib/reservas/agendar";

/** Definições das ferramentas (formato tool use da Anthropic) que a Hígia pode chamar. */
export const FERRAMENTAS_AGENDA = [
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
      "Cria uma reserva PROVISÓRIA (hold) para o cliente desta conversa, pendente de pagamento via Pix. Use depois de checar a disponibilidade e o cliente concordar com o horário. NÃO confirma pagamento — a equipe confirma após o comprovante. O sistema escolhe a sala livre automaticamente.",
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
      const r = await agendarReservaAgente({
        clienteId: ctx.clienteId,
        data: str(input.data),
        hora: str(input.hora),
        duracaoMin: num(input.duracao_min),
        finalidade: input.finalidade ? str(input.finalidade) : undefined,
        valor: input.valor != null ? num(input.valor) : undefined,
      });
      if ("erro" in r) return JSON.stringify({ ok: false, motivo: r.erro });
      return JSON.stringify({
        ok: true,
        reserva_provisoria: { sala: r.salaNome, data: r.data, hora: r.hora, duracao_min: r.duracaoMin },
        proximo_passo:
          "Reserva PROVISÓRIA registrada e o horário está segurado. Envie o Pix (marcador [PIX]) e explique que a equipe confirma após o comprovante. NÃO diga que o pagamento está confirmado.",
      });
    }

    return JSON.stringify({ ok: false, motivo: "ferramenta desconhecida" });
  } catch {
    return JSON.stringify({ ok: false, motivo: "erro interno ao executar a ferramenta" });
  }
}
