import { NextResponse } from "next/server";
import { exigirSessao } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { googleConfigurado, urlConsentimento } from "@/lib/google/oauth";

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
  return NextResponse.redirect(urlConsentimento());
}
