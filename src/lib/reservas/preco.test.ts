import { describe, it, expect } from "vitest";
import { precoAvulsaDia, calcularPrecoAvulsa } from "./preco";

describe("preço avulso (1h=40, 2h=65, 3h=105, 4h=125 meia diária, teto diária 235)", () => {
  it("tiers por dia", () => {
    expect(precoAvulsaDia(1)).toBe(40);
    expect(precoAvulsaDia(2)).toBe(65);
    expect(precoAvulsaDia(3)).toBe(105);
    expect(precoAvulsaDia(4)).toBe(125); // meia diária
    expect(precoAvulsaDia(5)).toBe(165); // 125 + 40
    expect(precoAvulsaDia(6)).toBe(190); // 125 + 65
    expect(precoAvulsaDia(8)).toBe(235); // teto: diária
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
