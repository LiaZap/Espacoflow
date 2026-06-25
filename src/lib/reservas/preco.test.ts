import { describe, it, expect } from "vitest";
import { precoAvulsaDia, calcularPrecoAvulsa } from "./preco";

describe("preço avulso (regra do cliente: 1h=40, 2h=65, +40/h)", () => {
  it("tiers por dia", () => {
    expect(precoAvulsaDia(1)).toBe(40);
    expect(precoAvulsaDia(2)).toBe(65);
    expect(precoAvulsaDia(3)).toBe(105);
    expect(precoAvulsaDia(4)).toBe(145);
  });

  it("soma POR DIA — exemplo exato do UAT (terça 2h + quarta 3h = R$170)", () => {
    const r = calcularPrecoAvulsa([
      { data: "2026-06-30", horas: 1 },
      { data: "2026-06-30", horas: 1 },
      { data: "2026-07-01", horas: 1 },
      { data: "2026-07-01", horas: 1 },
      { data: "2026-07-01", horas: 1 },
    ]);
    expect(r.total).toBe(170);
    expect(r.porDia).toEqual([
      { data: "2026-06-30", horas: 2, valor: 65 },
      { data: "2026-07-01", horas: 3, valor: 105 },
    ]);
  });
});
