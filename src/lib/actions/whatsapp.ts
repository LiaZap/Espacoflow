"use server";

import { obterEstadoWhatsapp } from "@/lib/mongo/client";
import {
  evolutionConfigurado,
  nomeInstancia,
  statusInstancia,
  criarInstancia,
  definirWebhook,
  dispararConexao,
  desconectarInstancia,
} from "@/lib/whatsapp/evolution-admin";
import { exigirPermissao } from "./_helpers";

function webhookUrl(): string {
  const base = process.env.WHATSAPP_WEBHOOK_URL
    ? process.env.WHATSAPP_WEBHOOK_URL
    : `${(process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/api/whatsapp/webhook`;
  // Reforço de auth: além do header x-webhook-token (definirWebhook), o token também
  // vai na query (?token=). Assim o webhook é validado mesmo se a Evolution não
  // repassar headers customizados — evita o cenário "conecta mas nada chega".
  const token = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (!token || base.includes("token=")) return base;
  return `${base}${base.includes("?") ? "&" : "?"}token=${encodeURIComponent(token)}`;
}

export interface StatusWhatsapp {
  configurado: boolean;
  conectado: boolean;
  estado: string;
  qr: string | null;
}

export async function statusWhatsapp(): Promise<StatusWhatsapp> {
  await exigirPermissao("configuracoes", "ler");
  if (!evolutionConfigurado()) {
    return { configurado: false, conectado: false, estado: "sem_config", qr: null };
  }
  const [s, estado] = await Promise.all([statusInstancia(), obterEstadoWhatsapp(nomeInstancia())]);
  const qr = !s.conectado ? ((estado?.qr_base64 as string | undefined) ?? null) : null;
  return { configurado: true, conectado: s.conectado, estado: s.estado, qr };
}

export async function conectarWhatsapp(): Promise<{ erro?: string }> {
  await exigirPermissao("configuracoes", "atualizar");
  if (!evolutionConfigurado()) {
    return { erro: "Defina WHATSAPP_API_URL e WHATSAPP_API_TOKEN (Evolution) no ambiente." };
  }
  const c = await criarInstancia();
  if (!c.ok) return { erro: c.erro };
  await definirWebhook(webhookUrl(), process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN);
  await dispararConexao();
  return {};
}

export async function desconectarWhatsapp(): Promise<{ erro?: string }> {
  await exigirPermissao("configuracoes", "atualizar");
  const r = await desconectarInstancia();
  return r.ok ? {} : { erro: r.erro };
}
