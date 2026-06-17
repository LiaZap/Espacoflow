import type { WhatsappProvider } from "./provider";

const MAX_BLOCO = 180; // caracteres por mensagem (bloco curto, como gente)
const CHARS_POR_SEG = 14; // velocidade de "digitação"
const DELAY_LEITURA_MS = 1500; // pausa inicial ("lendo")
const MIN_MS = 700;
const MAX_MS = 6000;
const PAUSA_ENTRE_MS = 600;

/** Quebra um texto em blocos curtos (parágrafos → sentenças), como um humano envia. */
export function picarMensagem(texto: string, max = MAX_BLOCO): string[] {
  const blocos: string[] = [];
  const paras = texto
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean);

  for (const p of paras) {
    if (p.length <= max) {
      blocos.push(p);
      continue;
    }
    const sentencas = p.split(/(?<=[.!?…])\s+/);
    let buf = "";
    for (const s of sentencas) {
      if (buf && `${buf} ${s}`.trim().length > max) {
        blocos.push(buf.trim());
        buf = s;
      } else {
        buf = buf ? `${buf} ${s}` : s;
      }
    }
    if (buf.trim()) blocos.push(buf.trim());
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
