import { describe, it, expect } from "vitest";
import { picarMensagem } from "./humanizar";

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
