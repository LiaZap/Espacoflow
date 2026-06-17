/**
 * Administração da instância Evolution API v2 (criar, conectar/QR, status, webhook).
 * O QR chega de forma assíncrona pelo webhook (evento qrcode.updated) — aqui só
 * disparamos a conexão e configuramos o webhook.
 */

const base = () => (process.env.WHATSAPP_API_URL ?? "").replace(/\/$/, "");
const key = () => process.env.WHATSAPP_API_TOKEN ?? "";
const instancia = () => process.env.WHATSAPP_INSTANCIA ?? "espaco-flow";

function headers() {
  return { "Content-Type": "application/json", apikey: key() };
}

export function evolutionConfigurado(): boolean {
  return Boolean(base() && key());
}

export function nomeInstancia(): string {
  return instancia();
}

/** Estado da conexão: open (conectado) | connecting | close | inexistente | offline. */
export async function statusInstancia(): Promise<{ conectado: boolean; estado: string }> {
  try {
    const res = await fetch(`${base()}/instance/connectionState/${instancia()}`, {
      headers: headers(),
    });
    if (res.status === 404) return { conectado: false, estado: "inexistente" };
    if (!res.ok) return { conectado: false, estado: "erro" };
    const d = (await res.json()) as { instance?: { state?: string } };
    const estado = d?.instance?.state ?? "desconhecido";
    return { conectado: estado === "open", estado };
  } catch {
    return { conectado: false, estado: "offline" };
  }
}

/** Cria a instância (idempotente — 403 = já existe). */
export async function criarInstancia(): Promise<{ ok: boolean; erro?: string }> {
  try {
    const res = await fetch(`${base()}/instance/create`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        instanceName: instancia(),
        integration: "WHATSAPP-BAILEYS",
        qrcode: true,
      }),
    });
    if (res.ok || res.status === 403) return { ok: true };
    return { ok: false, erro: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

/** Dispara a conexão (gera novo QR, entregue pelo webhook qrcode.updated). */
export async function dispararConexao(): Promise<void> {
  try {
    await fetch(`${base()}/instance/connect/${instancia()}`, { headers: headers() });
  } catch {
    // ignora — o QR chega pelo webhook
  }
}

/** Configura o webhook da Evolution para o nosso endpoint, com os eventos certos. */
export async function definirWebhook(url: string, token?: string): Promise<{ ok: boolean; erro?: string }> {
  try {
    const webhook: Record<string, unknown> = {
      enabled: true,
      url,
      events: ["QRCODE_UPDATED", "CONNECTION_UPDATE", "MESSAGES_UPSERT"],
      byEvents: false,
      base64: true,
    };
    if (token) webhook.headers = { "x-webhook-token": token };
    const res = await fetch(`${base()}/webhook/set/${instancia()}`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({ webhook }),
    });
    return res.ok ? { ok: true } : { ok: false, erro: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}

/** Desconecta o número (logout) sem apagar a instância. */
export async function desconectarInstancia(): Promise<{ ok: boolean; erro?: string }> {
  try {
    const res = await fetch(`${base()}/instance/logout/${instancia()}`, {
      method: "DELETE",
      headers: headers(),
    });
    return res.ok ? { ok: true } : { ok: false, erro: `HTTP ${res.status}` };
  } catch (e) {
    return { ok: false, erro: String(e) };
  }
}
