import type { WhatsappProvider } from "./provider";

const MAX_BLOCO = 240; // caracteres por mensagem (bloco curto, como gente)
const COALESCE_ATE = 120; // junta um bloco curto ao anterior se ele tiver menos que isto
const CHARS_POR_SEG = 14; // velocidade de "digitação"
const DELAY_LEITURA_MS = 1500; // pausa inicial ("lendo")
const MIN_MS = 700;
const MAX_MS = 6000;
const PAUSA_ENTRE_MS = 600;

/**
 * Normaliza a saída da Hígia para ficar "humana" e válida no WhatsApp:
 * - negrito markdown `**x**` → `*x*` (WhatsApp usa um asterisco só)
 * - remove travessão (—/–) e hífen solto entre espaços (cara de IA) → vírgula
 */
export function limparTextoHigia(texto: string): string {
  return texto
    .replace(/\*{2,}/g, "*") // **negrito** → *negrito*
    .replace(/_{2,}/g, "_")
    // 2h/4h NÃO são "pacote" (são avulsa com desconto). Não toca em 10h/20h/40h.
    .replace(/\bpacote\s*(?:de\s*)?2\s*h(?:oras?)?\b/gi, "2 horas")
    .replace(/\bpacote\s*(?:de\s*)?4\s*h(?:oras?)?\b/gi, "meia diária")
    .replace(/\s*[—–]\s*/g, ", ") // travessão / en-dash → vírgula
    .replace(/ +- +/g, ", ") // " - " conector → vírgula
    .replace(/[ \t]{2,}/g, " ")
    .replace(/ +([,.;:!?])/g, "$1") // espaço antes de pontuação
    .replace(/(^|\n)\s*[,.;:]\s*/g, "$1") // pontuação órfã no início de linha
    .trim();
}

/** true se o bloco NÃO tem texto real (só emoji/pontuação/símbolo/espaço). */
function semTexto(s: string): boolean {
  return !/[\p{L}\p{N}]/u.test(s);
}

/** Quebra um texto em blocos curtos (parágrafos → sentenças), como um humano envia. */
export function picarMensagem(texto: string, max = MAX_BLOCO): string[] {
  const brutos: string[] = [];
  const paras = texto
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const p of paras) {
    if (p.length <= max) {
      brutos.push(p);
      continue;
    }
    const sentencas = p.split(/(?<=[.!?…])\s+/);
    let buf = "";
    for (const s of sentencas) {
      if (buf && `${buf} ${s}`.trim().length > max) {
        brutos.push(buf.trim());
        buf = s;
      } else {
        buf = buf ? `${buf} ${s}` : s;
      }
    }
    if (buf.trim()) brutos.push(buf.trim());
  }

  // Pós-processo: (1) bloco só-emoji/pontuação NÃO vira mensagem solta — cola no anterior;
  // (2) junta blocos curtos adjacentes p/ não fragmentar demais (mantendo abaixo de `max`).
  const blocos: string[] = [];
  for (const b of brutos) {
    const t = b.trim();
    if (!t) continue;
    if (semTexto(t)) {
      if (blocos.length) blocos[blocos.length - 1] = `${blocos[blocos.length - 1]} ${t}`.trim();
      continue; // sem bloco anterior → descarta emoji/pontuação solta
    }
    const ult = blocos[blocos.length - 1];
    if (ult && ult.length < COALESCE_ATE && `${ult} ${t}`.length <= max) {
      blocos[blocos.length - 1] = `${ult} ${t}`;
    } else {
      blocos.push(t);
    }
  }
  return blocos.length ? blocos : [texto.trim()];
}

function jitter(ms: number): number {
  return Math.round(ms * (0.8 + Math.random() * 0.4));
}
function esperar(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export interface HookBloco {
  onBloco: (texto: string, idExterno: string | null, ok: boolean) => Promise<void>;
}

/**
 * Envia o texto de forma HUMANA: pausa de leitura, "digitando…", mensagens picadas
 * em blocos curtos com delay proporcional ao tamanho, e pausa entre blocos.
 */
export async function enviarHumanizado(
  provider: WhatsappProvider,
  telefone: string,
  texto: string,
  hook?: HookBloco
): Promise<{ blocos: number; algumOk: boolean }> {
  const blocos = picarMensagem(texto);
  let algumOk = false;

  await esperar(jitter(DELAY_LEITURA_MS));

  for (let i = 0; i < blocos.length; i++) {
    const bloco = blocos[i];
    if (!bloco?.trim()) continue; // defensivo: nunca envia bloco vazio
    await provider.definirPresenca(telefone, "composing").catch(() => undefined);
    const tempo = Math.min(MAX_MS, Math.max(MIN_MS, (bloco.length / CHARS_POR_SEG) * 1000));
    await esperar(jitter(tempo));

    const envio = await provider.enviarTexto(telefone, bloco);
    algumOk = algumOk || envio.ok;
    await provider.definirPresenca(telefone, "paused").catch(() => undefined);

    if (hook) await hook.onBloco(bloco, envio.idExterno, envio.ok);
    if (i < blocos.length - 1) await esperar(jitter(PAUSA_ENTRE_MS));
  }

  return { blocos: blocos.length, algumOk };
}
