/**
 * OAuth do Google — fluxo manual (sem dependência googleapis).
 * Credenciais do app via env: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e
 * (opcional) GOOGLE_REDIRECT_URI.
 * Escopos: calendar.events (agenda) + spreadsheets.readonly (ler respostas do
 * formulário de cadastro) + email. Ao adicionar o escopo de planilha, é preciso
 * RECONECTAR a conta uma vez para o token passar a ter acesso.
 */
import { randomBytes } from "crypto";

const SCOPE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
].join(" ");

/** Nome do cookie httpOnly que guarda o `state` anti-CSRF do fluxo OAuth. */
export const OAUTH_STATE_COOKIE = "g_oauth_state";

export function googleConfigurado(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** Gera um token `state` aleatório (128 bits) para proteger o callback contra CSRF. */
export function gerarState(): string {
  return randomBytes(16).toString("hex");
}

export function redirectUri(): string {
  if (process.env.GOOGLE_REDIRECT_URI) return process.env.GOOGLE_REDIRECT_URI;
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/google/oauth/callback`;
}

/** URL de consentimento do Google (offline + consent → garante refresh_token). */
export function urlConsentimento(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID ?? "",
    redirect_uri: redirectUri(),
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    scope: SCOPE,
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p.toString()}`;
}

export interface TokensGoogle {
  refresh_token: string | null;
  access_token: string;
  expira_em: Date;
  email: string | null;
}

/** Troca o code do callback por tokens e descobre o e-mail da conta. */
export async function trocarCodigo(code: string): Promise<TokensGoogle> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID ?? "",
      client_secret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      redirect_uri: redirectUri(),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) throw new Error(`token HTTP ${res.status}`);
  const t = (await res.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  let email: string | null = null;
  try {
    const u = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
      headers: { authorization: `Bearer ${t.access_token}` },
    });
    if (u.ok) email = ((await u.json()) as { email?: string }).email ?? null;
  } catch {
    // e-mail é informativo; não bloqueia a conexão
  }

  return {
    refresh_token: t.refresh_token ?? null,
    access_token: t.access_token,
    expira_em: new Date(Date.now() + (t.expires_in ?? 3600) * 1000),
    email,
  };
}
