/**
 * Cálculo de preço de reservas AVULSAS, determinístico e POR DIA (UAT R01/R02).
 * Tarifas por dia (o sistema combina os blocos para dar o MENOR preço ao cliente):
 *   1h = R$40 · 2h = R$65 · 4h (meia diária) = R$125 · diária (>=8h) = R$235 (teto).
 * Exemplos confirmados: 3h = 65+40 = 105 · 4h = 125 · 5h = 125+40 = 165.
 * O total é a SOMA por dia (dias diferentes nunca se misturam).
 * Pacotes (10h/20h/40h) NÃO entram aqui — só quando o cliente já tem/escolhe um.
 */

const HORA_AVULSA = 40; // R$/h
const BLOCO_2H = 65; // R$ por 2h no mesmo dia
const MEIA_DIARIA_4H = 125; // R$ por 4h no mesmo dia
const DIARIA = 235; // R$ teto do dia (diária 8h–19h)

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Preço avulso de UM dia, SÓ para durações em horas INTEIRAS (blocos da tabela).
 * Usa os maiores blocos primeiro (mais baratos por hora); nunca passa da diária.
 * Duração fracionada (ex.: 1h30) NÃO tem preço de tabela — retorna 0 aqui; use
 * precoAvulsaDiaDetalhe para tratar o caso "fora da tabela".
 */
export function precoAvulsaDia(horas: number): number {
  if (!Number.isFinite(horas) || horas <= 0) return 0;
  if (!Number.isInteger(horas)) return 0; // fração de hora não é tabelada
  let resto = horas;
  let total = 0;
  while (resto >= 4) {
    total += MEIA_DIARIA_4H;
    resto -= 4;
  }
  while (resto >= 2) {
    total += BLOCO_2H;
    resto -= 2;
  }
  if (resto >= 1) {
    total += HORA_AVULSA;
    resto -= 1;
  }
  return round2(Math.min(total, DIARIA));
}

export interface VizinhaPreco {
  horas: number;
  valor: number;
}
export interface PrecoDetalheDia {
  /** false quando a duração não existe na tabela (ex.: 1h30). */
  exato: boolean;
  valor: number; // válido quando exato
  /** opções tabeladas mais próximas (piso/teto) quando não é exato. */
  vizinhas?: VizinhaPreco[];
}

/**
 * Preço detalhado de UM dia: para horas inteiras devolve o valor exato; para durações
 * fracionadas devolve exato=false + as opções tabeladas vizinhas (piso e teto), SEM
 * inventar valor proporcional.
 */
export function precoAvulsaDiaDetalhe(horas: number): PrecoDetalheDia {
  if (!Number.isFinite(horas) || horas <= 0) return { exato: true, valor: 0 };
  if (Number.isInteger(horas)) return { exato: true, valor: precoAvulsaDia(horas) };
  const piso = Math.floor(horas);
  const teto = Math.ceil(horas);
  const vizinhas: VizinhaPreco[] = [];
  if (piso >= 1) vizinhas.push({ horas: piso, valor: precoAvulsaDia(piso) });
  vizinhas.push({ horas: teto, valor: precoAvulsaDia(teto) });
  return { exato: false, valor: 0, vizinhas };
}

export interface SessaoPreco {
  data: string; // AAAA-MM-DD
  horas: number;
}
export interface PrecoPorDia {
  data: string;
  horas: number;
  valor: number;
  exato: boolean;
  vizinhas?: VizinhaPreco[];
}
export interface ResultadoPreco {
  total: number;
  porDia: PrecoPorDia[];
  /** false se ALGUM dia tem duração fora da tabela (não somável exatamente). */
  exato: boolean;
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
    .map(([data, horas]) => {
      const h = round2(horas);
      const d = precoAvulsaDiaDetalhe(h);
      return { data, horas: h, valor: d.valor, exato: d.exato, ...(d.vizinhas ? { vizinhas: d.vizinhas } : {}) };
    });
  const exato = porDia.every((d) => d.exato);
  // Só soma dias com valor EXATO — dias fora da tabela não entram no total (o caller
  // deve oferecer as opções vizinhas em vez de cobrar um valor inventado).
  const total = round2(porDia.reduce((acc, d) => acc + (d.exato ? d.valor : 0), 0));
  return { total, porDia, exato };
}
