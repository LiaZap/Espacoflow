import { describe, it, expect } from "vitest";
import { ehRecorrente } from "./onboarding";

describe("ehRecorrente (gate duro: quem NÃO pode receber pedido de cadastro)", () => {
  it("é recorrente quem já é 'cliente' na base", () => {
    expect(ehRecorrente("cliente", false)).toBe(true);
  });

  it("é recorrente quem já teve reserva confirmada/concluída, mesmo com outro status", () => {
    expect(ehRecorrente("apto", true)).toBe(true);
    expect(ehRecorrente("novo", true)).toBe(true);
  });

  it("cliente novo de verdade NÃO é recorrente (precisa de cadastro/aceite)", () => {
    expect(ehRecorrente("novo", false)).toBe(false);
    expect(ehRecorrente(null, false)).toBe(false);
    expect(ehRecorrente(undefined, false)).toBe(false);
  });
});
