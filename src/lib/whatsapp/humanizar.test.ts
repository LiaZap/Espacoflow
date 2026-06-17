import { describe, it, expect } from "vitest";
import { picarMensagem } from "./humanizar";

describe("picarMensagem (mensagens picadas como humano)", () => {
  it("mantém mensagem curta em um único bloco", () => {
    expect(picarMensagem("Oi, tudo bem?")).toEqual(["Oi, tudo bem?"]);
  });

  it("separa por parágrafos (linha em branco)", () => {
    expect(picarMensagem("Bloco um.\n\nBloco dois.")).toEqual(["Bloco um.", "Bloco dois."]);
  });

  it("quebra parágrafo longo por sentenças, respeitando o máximo", () => {
    const longo = "Frase de teste aqui. ".repeat(20).trim();
    const blocos = picarMensagem(longo, 80);
    expect(blocos.length).toBeGreaterThan(1);
    for (const b of blocos) expect(b.length).toBeLessThanOrEqual(80);
  });
});
