import { describe, it, expect } from "vitest";
import { calcularJanela } from "./disponibilidade";
import { formatarDataHora } from "../utils";

// Bug UAT R03: a Hígia confirmou "03/07 das 09h às 11h" mas o App mostrava "início 12h".
// Causa: o servidor (Docker/EasyPanel) roda em UTC e formatava o instante UTC cru.
describe("timezone: a reserva exibida no App bate com o resumo confirmado ao cliente", () => {
  it("09:00 Brasília grava 12:00 UTC e EXIBE 09:00 (nunca 12:00)", () => {
    const { inicio, fim } = calcularJanela("2026-07-03", "09:00", 120);
    // O instante gravado está certo (09h BRT = 12h UTC).
    expect(inicio.toISOString()).toBe("2026-07-03T12:00:00.000Z");
    expect(fim.toISOString()).toBe("2026-07-03T14:00:00.000Z");
    // O que o App mostra precisa ser 09:00–11:00 (fuso de Brasília), não 12:00.
    const ini = formatarDataHora(inicio);
    const f = formatarDataHora(fim);
    expect(ini).toContain("03/07/2026");
    expect(ini).toContain("09:00");
    expect(ini).not.toContain("12:00");
    expect(f).toContain("11:00");
  });
});
