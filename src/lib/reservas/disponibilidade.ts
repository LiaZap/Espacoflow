/**
 * Cálculo de janela de reserva no fuso America/Sao_Paulo.
 * O Brasil não usa horário de verão desde 2019, então o offset é fixo -03:00.
 */
const OFFSET_BR = "-03:00";

export function calcularJanela(data: string, hora: string, duracaoMin: number) {
  const hhmm = hora.slice(0, 5);
  const inicio = new Date(`${data}T${hhmm}:00${OFFSET_BR}`);
  const fim = new Date(inicio.getTime() + duracaoMin * 60_000);
  return { inicio, fim };
}

/** Horas (decimal) a partir de minutos. Ex.: 90 -> 1.5 */
export function minutosParaHoras(min: number): number {
  return Math.round((min / 60) * 100) / 100;
}

/** Jornada de funcionamento do FLOW (07h–23h) em minutos. */
export const ABRE_MIN = 7 * 60;
export const FECHA_MIN = 23 * 60;
export const JORNADA_MIN = FECHA_MIN - ABRE_MIN; // 960
