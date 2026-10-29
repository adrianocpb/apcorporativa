import { NextResponse, type NextRequest } from "next/server";

// Verificação otimista: sem cookie de sessão, nem chega a renderizar a página protegida.
// A validação real (sessão no banco, usuário ativo, permissões) acontece no servidor,
// em cada layout, página e Server Action.
const PUBLIC_PREFIXES = ["/entrar", "/esqueci-senha", "/convite/", "/redefinir-senha/"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(p))) {
    return NextResponse.next();
  }
  if (!request.cookies.has("apc_session")) {
    const url = new URL("/entrar", request.url);
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt).*)"],
};
