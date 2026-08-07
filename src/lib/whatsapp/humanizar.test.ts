import { describe, it, expect } from "vitest";
import { picarMensagem, prometeAtendimentoHumano } from "./humanizar";

describe("prometeAtendimentoHumano (escalação garantida)", () => {
  it("detecta a promessa de handoff (sem o marcador [HUMANO]) e escala", () => {
    for (const t of [
      "Vou passar para a nossa equipe verificar isso pra você!",
      "Deixa eu chamar a equipe pra te ajudar com o crédito.",
      "Vou encaminhar para o suporte confirmar a disponibilidade.",
      "Vou verificar com a equipe e te retorno.",
      "A equipe vai entrar em contato com você.",
      "Vou transferir seu atendimento para um atendente.",
    ]) {
      expect(prometeAtendimentoHumano(t), t).toBe(true);
    }
  });

  it("não escala à toa em mensagens normais do fluxo", () => {
    for (const t of [
      "A Sala 02 está disponível no dia 13/07 às 10h. Quer ficar com ela?",
      "Pra confirmar, me envia aqui o comprovante do Pix, tá?",
      "Recebi seu comprovante! 🙏",
      "Já segurei o seu horário! Sala 01, 20/07 às 14h.",
      "Seu saldo restante é de 18 horas.",
    ]) {
      expect(prometeAtendimentoHumano(t), t).toBe(false);
    }
  });
});

describe("picarMensagem (mensagens picadas como humano)", () => {
  it("mantém mensagem curta em um único bloco", () => {
    expect(picarMensagem("Oi, tudo bem?")).toEqual(["Oi, tudo bem?"]);
  });

  it("junta parágrafos curtos adjacentes numa mensagem só (menos fragmentação)", () => {
    expect(picarMensagem("Bloco um.\n\nBloco dois.")).toEqual(["Bloco um. Bloco dois."]);
  });

  it("NÃO envia bloco só com emoji — cola no bloco de texto anterior", () => {
    expect(picarMensagem("Sua reserva está confirmada.\n\n😊")).toEqual(["Sua reserva está confirmada. 😊"]);
  });

  it("descarta bloco só de pontuação/emoji quando não há texto antes", () => {
    // whitespace/pontuação órfã não vira mensagem vazia (cai no fallback do texto todo)
    expect(picarMensagem("Tudo certo! 🙌")).toEqual(["Tudo certo! 🙌"]);
  });

  it("quebra parágrafo longo por sentenças, respeitando o máximo", () => {
    const longo = "Frase de teste aqui. ".repeat(20).trim();
    const blocos = picarMensagem(longo, 80);
    expect(blocos.length).toBeGreaterThan(1);
    for (const b of blocos) expect(b.length).toBeLessThanOrEqual(80);
  });
});
