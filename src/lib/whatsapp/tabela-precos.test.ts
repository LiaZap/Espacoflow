import { describe, it, expect } from "vitest";
import { extrairTabela } from "./tabela-precos";

describe("extrairTabela (marcador [TABELA])", () => {
  it("detecta e remove o marcador do texto", () => {
    const r = extrairTabela("Claro! Aqui estão os valores:\n[TABELA]");
    expect(r.temTabela).toBe(true);
    expect(r.texto).toBe("Claro! Aqui estão os valores:");
  });
  it("sem marcador, não altera e retorna false", () => {
    const r = extrairTabela("Temos salas a partir de R$ 40.");
    expect(r.temTabela).toBe(false);
    expect(r.texto).toBe("Temos salas a partir de R$ 40.");
  });
});
