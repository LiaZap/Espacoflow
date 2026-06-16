import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ROTAS_LOGIN = ["/login", "/recuperar-senha"];

/**
 * Verificação leve: presença do cookie de sessão.
 * A validação real (sessão no banco, expiração, RBAC) acontece no server
 * (getSession) em cada page/action.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Rotas de API (ex.: webhook do WhatsApp) cuidam da própria autorização.
  if (pathname.startsWith("/api/")) return NextResponse.next();

  // Landing pública: qualquer pessoa vê.
  if (pathname === "/") return NextResponse.next();

  const temSessao = req.cookies.has("flow_session");
  const ehLogin = ROTAS_LOGIN.some((r) => pathname.startsWith(r));

  // Páginas de login: usuário já logado vai direto ao painel.
  if (ehLogin) {
    if (temSessao) return NextResponse.redirect(new URL("/dashboard", req.url));
    return NextResponse.next();
  }

  // Demais rotas exigem sessão.
  if (!temSessao) return NextResponse.redirect(new URL("/login", req.url));
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)",
  ],
};
