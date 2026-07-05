import { describe, it, expect } from "vitest";
import { calcularSaldoCredito } from "./credito";

const AGORA = new Date("2026-07-04T12:00:00Z").getTime();
const futuro = new Date("2026-08-01T12:00:00Z"); // dentro da validade
const passado = new Date("2026-06-01T12:00:00Z"); // crédito vencido

describe("calcularSaldoCredito (carteira de crédito em R$)", () => {
  it("soma créditos vigentes e subtrai débitos", () => {
    const s = calcularSaldoCredito(
      [
        { valor: "65.00", expira_em: futuro }, // crédito de cancelamento
        { valor: "-40.00", expira_em: null }, // usou R$40 numa reserva
      ],
      AGORA
    );
    expect(s).toBe(25);
  });

  it("crédito VENCIDO não conta", () => {
    const s = calcularSaldoCredito([{ valor: "65.00", expira_em: passado }], AGORA);
    expect(s).toBe(0);
  });

  it("nunca fica negativo (piso 0)", () => {
    const s = calcularSaldoCredito(
      [
        { valor: "65.00", expira_em: passado }, // venceu, não conta
        { valor: "-40.00", expira_em: null }, // débito remanescente
      ],
      AGORA
    );
    expect(s).toBe(0);
  });

  it("débito nunca 'vence' (sempre subtrai), crédito vigente conta", () => {
    const s = calcularSaldoCredito(
      [
        { valor: "100.00", expira_em: futuro },
        { valor: "-30.00", expira_em: null },
      ],
      AGORA
    );
    expect(s).toBe(70);
  });

  it("multi-lote: o débito consome o lote que vence ANTES — não come o lote válido", () => {
    // Lote A (vence antes, JÁ vencido em AGORA) e Lote B (vigente). Gastou 50.
    // O débito deve consumir A (vence primeiro); B (válido) permanece = 50.
    const loteA_vencido = new Date("2026-07-01T12:00:00Z"); // < AGORA
    const loteB_vigente = new Date("2026-09-01T12:00:00Z"); // > AGORA
    const s = calcularSaldoCredito(
      [
        { valor: "50.00", expira_em: loteA_vencido },
        { valor: "50.00", expira_em: loteB_vigente },
        { valor: "-50.00", expira_em: null },
      ],
      AGORA
    );
    expect(s).toBe(50); // NÃO 0 — o cliente não perde o lote B válido
  });

  it("multi-lote: gasto parcial abate primeiro o lote que expira antes", () => {
    const cedo = new Date("2026-07-20T12:00:00Z");
    const tarde = new Date("2026-09-01T12:00:00Z");
    const s = calcularSaldoCredito(
      [
        { valor: "40.00", expira_em: cedo },
        { valor: "40.00", expira_em: tarde },
        { valor: "-30.00", expira_em: null }, // consome 30 do lote "cedo" (sobra 10) + 40 do tarde
      ],
      AGORA
    );
    expect(s).toBe(50);
  });
});
