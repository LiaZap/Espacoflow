import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { googleConfigurado, urlConsentimento, gerarState, OAUTH_STATE_COOKIE } from "@/lib/google/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function base(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Inicia o OAuth do Google Agenda (somente admin autenticado). */
export async function GET() {
  let sessao;
  try {
    sessao = await exigirSessao();
  } catch {
    return NextResponse.redirect(`${base()}/login`);
  }
  if (!temPermissao(sessao.role, "configuracoes", "atualizar")) {
    return NextResponse.redirect(`${base()}/configuracoes/agenda?erro=sem_permissao`);
  }
  if (!googleConfigurado()) {
    return NextResponse.redirect(`${base()}/configuracoes/agenda?erro=sem_credenciais`);
  }

  // CSRF: gera um `state` aleatório, guarda em cookie httpOnly e injeta na URL.
  const state = gerarState();
  const res = NextResponse.redirect(urlConsentimento(state));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // o callback chega via navegação top-level do Google
    path: "/api/google/oauth",
    maxAge: 600, // 10 min
  });
  return res;
}
