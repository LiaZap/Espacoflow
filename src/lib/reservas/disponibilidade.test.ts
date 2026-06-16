import { describe, it, expect } from "vitest";
import { calcularJanela, minutosParaHoras } from "./disponibilidade";

describe("calcularJanela", () => {
  it("interpreta data/hora no fuso -03:00 e soma a duração", () => {
    const { inicio, fim } = calcularJanela("2026-06-20", "14:00", 90);
    expect(inicio.toISOString()).toBe("2026-06-20T17:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-06-20T18:30:00.000Z");
  });

  it("aceita hora no formato HH:MM:SS", () => {
    const { inicio } = calcularJanela("2026-01-01", "07:00:00", 60);
    expect(inicio.toISOString()).toBe("2026-01-01T10:00:00.000Z");
  });
});

describe("minutosParaHoras", () => {
  it("converte minutos em horas decimais", () => {
    expect(minutosParaHoras(90)).toBe(1.5);
    expect(minutosParaHoras(60)).toBe(1);
    expect(minutosParaHoras(30)).toBe(0.5);
  });
});
