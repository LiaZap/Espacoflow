/**
 * Cálculo de preço de reservas AVULSAS, determinístico e POR DIA.
 * Regra do cliente (UAT R01): a hora avulsa é R$40; a partir de 2h há desconto
 * progressivo no mesmo dia:
 *   1h = R$40 · 2h = R$65 · cada hora acima de 2h = +R$40 (ex.: 3h = 65 + 40 = 105).
 * O total é a SOMA por dia (dias diferentes nunca se misturam).
 * Pacotes (10h/20h/40h) NÃO entram aqui — só quando o cliente já tem/escolhe um.
 */

const HORA_AVULSA = 40; // R$/h
const BLOCO_2H = 65; // R$ pelas 2 primeiras horas no mesmo dia

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Preço avulso de um único dia, conforme as horas usadas nesse dia. */
export function precoAvulsaDia(horas: number): number {
  if (!Number.isFinite(horas) || horas <= 0) return 0;
  if (horas <= 1) return round2(HORA_AVULSA * horas);
  // 2ª hora custa (65-40)=25; após 2h, cada hora cheia avulsa (40).
  if (horas <= 2) return round2(HORA_AVULSA + (horas - 1) * (BLOCO_2H - HORA_AVULSA));
  return round2(BLOCO_2H + (horas - 2) * HORA_AVULSA);
}

export interface SessaoPreco {
  data: string; // AAAA-MM-DD
  horas: number;
}
export interface PrecoPorDia {
  data: string;
  horas: number;
  valor: number;
}
export interface ResultadoPreco {
  total: number;
  porDia: PrecoPorDia[];
}

/**
 * Soma o preço de várias sessões, AGRUPANDO por dia (cada dia calculado isolado
 * com a regra avulsa progressiva). É a fonte da verdade do valor que a Hígia informa.
 */
export function calcularPrecoAvulsa(sessoes: SessaoPreco[]): ResultadoPreco {
  const horasPorDia = new Map<string, number>();
  for (const s of sessoes) {
    if (!s?.data) continue;
    const h = Number(s.horas);
    if (!Number.isFinite(h) || h <= 0) continue;
    horasPorDia.set(s.data, (horasPorDia.get(s.data) ?? 0) + h);
  }
  const porDia: PrecoPorDia[] = [...horasPorDia.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([data, horas]) => ({ data, horas: round2(horas), valor: precoAvulsaDia(horas) }));
  const total = round2(porDia.reduce((acc, d) => acc + d.valor, 0));
  return { total, porDia };
}
