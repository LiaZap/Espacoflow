import { describe, it, expect } from "vitest";
import { janelaSanitizada } from "./agendar";

const DATA = "2026-12-10"; // data futura qualquer (a função não checa passado)

describe("janelaSanitizada — grade operacional do Flow", () => {
  it("aceita duração em HORAS CHEIAS (1h, 2h, 3h)", () => {
    for (const min of [60, 120, 180, 240]) {
      expect(janelaSanitizada(DATA, "10:00", min), `${min}min`).toBeNull();
    }
  });

  it("RECUSA 1h30 (90 min) — reserva fracionada não existe", () => {
    // Caso real do relatório: a Hígia ofereceu "Sala 01 disponível por 1h30".
    expect(janelaSanitizada(DATA, "18:00", 90)).toMatch(/hora cheia/i);
  });

  it("RECUSA menos de 1 hora (ex.: 10h-10h50)", () => {
    expect(janelaSanitizada(DATA, "10:00", 50)).toMatch(/hora cheia|mínimo/i);
  });

  it("aceita INÍCIO de 30 em 30 min (10:00 e 10:30)", () => {
    expect(janelaSanitizada(DATA, "10:00", 60)).toBeNull();
    expect(janelaSanitizada(DATA, "10:30", 60)).toBeNull();
  });

  it("RECUSA início fora da grade (10:15 / 10:45)", () => {
    expect(janelaSanitizada(DATA, "10:15", 60)).toMatch(/30 em 30/i);
    expect(janelaSanitizada(DATA, "10:45", 60)).toMatch(/30 em 30/i);
  });

  it("RECUSA fora do horário de funcionamento (07h às 23h)", () => {
    expect(janelaSanitizada(DATA, "06:00", 60)).toMatch(/funcionamento/i);
    expect(janelaSanitizada(DATA, "22:30", 120)).toMatch(/funcionamento/i);
  });
});
