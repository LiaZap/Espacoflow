/**
 * Camada de provedor WhatsApp (agnóstica). Secrets só via env — nunca no banco.
 * Suporta Evolution API; sem credenciais cai no provedor "sandbox" (apenas loga).
 */

export interface MensagemEnviada {
  ok: boolean;
  idExterno: string | null;
  erro?: string;
}

export type Presenca = "composing" | "paused";

export interface MidiaEnvio {
  tipo: "image" | "video" | "audio" | "document";
  url: string;
  legenda?: string;
  nomeArquivo?: string;
}

export interface WhatsappProvider {
  nome: string;
  enviarTexto(paraTelefone: string, texto: string): Promise<MensagemEnviada>;
  /** Envia foto/arquivo (a Hígia manda fotos das salas, PDFs de preços etc.). */
  enviarMidia(paraTelefone: string, midia: MidiaEnvio): Promise<MensagemEnviada>;
  /** Indicador "digitando…"/pausado no WhatsApp (comportamento humano). */
  definirPresenca(paraTelefone: string, estado: Presenca): Promise<void>;
}

class EvolutionProvider implements WhatsappProvider {
  nome = "evolution";
  constructor(
    private url: string,
    private apikey: string,
    private instancia: string
  ) {}

  async enviarTexto(para: string, texto: string): Promise<MensagemEnviada> {
    try {
      const res = await fetch(`${this.url}/message/sendText/${this.instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apikey },
        body: JSON.stringify({ number: para, text: texto }),
      });
      if (!res.ok) return { ok: false, idExterno: null, erro: `HTTP ${res.status}` };
      const data = (await res.json().catch(() => ({}))) as { key?: { id?: string }; id?: string };
      return { ok: true, idExterno: data?.key?.id ?? data?.id ?? null };
    } catch (e) {
      return { ok: false, idExterno: null, erro: String(e) };
    }
  }

  async enviarMidia(para: string, midia: MidiaEnvio): Promise<MensagemEnviada> {
    try {
      const body: Record<string, unknown> = {
        number: para,
        mediatype: midia.tipo,
        media: midia.url,
      };
      if (midia.legenda) body.caption = midia.legenda;
      if (midia.nomeArquivo) body.fileName = midia.nomeArquivo;
      const res = await fetch(`${this.url}/message/sendMedia/${this.instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apikey },
        body: JSON.stringify(body),
      });
      if (!res.ok) return { ok: false, idExterno: null, erro: `HTTP ${res.status}` };
      const data = (await res.json().catch(() => ({}))) as { key?: { id?: string }; id?: string };
      return { ok: true, idExterno: data?.key?.id ?? data?.id ?? null };
    } catch (e) {
      return { ok: false, idExterno: null, erro: String(e) };
    }
  }

  async definirPresenca(para: string, estado: Presenca): Promise<void> {
    try {
      await fetch(`${this.url}/chat/sendPresence/${this.instancia}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: this.apikey },
        body: JSON.stringify({ number: para, presence: estado, delay: 1200 }),
      });
    } catch {
      // presença é "best-effort": nunca bloqueia o envio
    }
  }
}

class SandboxProvider implements WhatsappProvider {
  nome = "sandbox";
  async enviarTexto(para: string, texto: string): Promise<MensagemEnviada> {
    console.log(`[whatsapp:sandbox] -> ${para}: ${texto.slice(0, 160)}`);
    return { ok: true, idExterno: `sandbox-${Date.now()}` };
  }
  async enviarMidia(para: string, midia: MidiaEnvio): Promise<MensagemEnviada> {
    console.log(`[whatsapp:sandbox] mídia ${midia.tipo} -> ${para}: ${midia.url}`);
    return { ok: true, idExterno: `sandbox-${Date.now()}` };
  }
  async definirPresenca(para: string, estado: Presenca): Promise<void> {
    console.log(`[whatsapp:sandbox] presence ${estado} -> ${para}`);
  }
}

export function getProvider(): WhatsappProvider {
  const url = process.env.WHATSAPP_API_URL;
  const token = process.env.WHATSAPP_API_TOKEN;
  const instancia = process.env.WHATSAPP_INSTANCIA ?? "espaco-flow";
  const provider = process.env.WHATSAPP_PROVIDER ?? "evolution";

  if (url && token && provider === "evolution") {
    return new EvolutionProvider(url, token, instancia);
  }
  return new SandboxProvider();
}

export function provedorConfigurado(): boolean {
  return Boolean(process.env.WHATSAPP_API_URL && process.env.WHATSAPP_API_TOKEN);
}
