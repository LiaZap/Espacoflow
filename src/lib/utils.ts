import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina classes Tailwind com merge inteligente (shadcn/ui). */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Formata valor em centavos (inteiro) para moeda BRL. */
export function formatarBRL(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/**
 * Formata data para pt-BR (dd/mm/aaaa hh:mm) SEMPRE no fuso America/Sao_Paulo.
 * Sem timeZone fixo, o servidor (Docker/EasyPanel roda em UTC) formataria o instante
 * UTC cru — ex.: 09h Brasília (12h UTC) apareceria como 12h. O Brasil não usa horário
 * de verão desde 2019, então o fuso é estável.
 */
export function formatarDataHora(data: Date | string): string {
  const d = typeof data === "string" ? new Date(data) : data;
  return d.toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
