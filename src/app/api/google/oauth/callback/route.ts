import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { exigirSessao } from "@/lib/auth";
import { temPermissao } from "@/lib/auth/rbac";
import { db } from "@/lib/db";
import { googleAgendaConfig } from "@/lib/db/schema/integracoes";
import { trocarCodigo, OAUTH_STATE_COOKIE } from "@/lib/google/oauth";
import { registrarAuditoria } from "@/lib/audit/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function base(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** Callback do OAuth: troca o code por tokens e marca como conectado. */
export async function GET(req: Request) {
  let sessao;
  try {
    sessao = await exigirSessao();
  } catch {
    return NextResponse.redirect(`${base()}/login`);
  }
  if (!temPermissao(sessao.role, "configuracoes", "atualizar")) {
    return NextResponse.redirect(`${base()}/configuracoes/agenda?erro=sem_permissao`);
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (url.searchParams.get("error") || !code) {
    return NextResponse.redirect(`${base()}/configuracoes/agenda?erro=oauth`);
  }

  // CSRF: o `state` do retorno tem que bater com o cookie httpOnly gravado no start.
  const stateRecebido = url.searchParams.get("state");
  const stateCookie = req.headers
    .get("cookie")
    ?.split(/;\s*/)
    .find((c) => c.startsWith(`${OAUTH_STATE_COOKIE}=`))
    ?.slice(OAUTH_STATE_COOKIE.length + 1);
  const limparCookie = (resp: NextResponse) => {
    resp.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/google/oauth", maxAge: 0 });
    return resp;
  };
  if (!stateRecebido || !stateCookie || stateRecebido !== stateCookie) {
    return limparCookie(NextResponse.redirect(`${base()}/configuracoes/agenda?erro=state`));
  }

  try {
    const t = await trocarCodigo(code);
    const valores = {
      conectado: true,
      conta_email: t.email,
      access_token: t.access_token,
      token_expira_em: t.expira_em,
      updated_at: new Date(),
      modified_by: sessao.userId,
      ...(t.refresh_token ? { refresh_token: t.refresh_token } : {}),
    };

    const [c] = await db
      .select()
      .from(googleAgendaConfig)
      .where(eq(googleAgendaConfig.is_deleted, false))
      .limit(1);
    if (c) await db.update(googleAgendaConfig).set(valores).where(eq(googleAgendaConfig.id, c.id));
    else await db.insert(googleAgendaConfig).values(valores);

    await registrarAuditoria({
      userId: sessao.userId,
      acao: "atualizar",
      entidade: "google_agenda_config",
      detalhes: `Conectou Google Agenda (${t.email ?? "conta"})`,
    });

    return limparCookie(NextResponse.redirect(`${base()}/configuracoes/agenda?ok=conectado`));
  } catch {
    return limparCookie(NextResponse.redirect(`${base()}/configuracoes/agenda?erro=token`));
  }
}
