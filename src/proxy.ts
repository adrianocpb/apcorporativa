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
  // /api fica de fora: as rotas de API validam a sessão e respondem 401 (sem redirecionar),
  // e o upload em fluxo não deve ser bufferizado pelo proxy.
  matcher: ["/((?!api/|_next/static|_next/image|icon.svg|robots.txt).*)"],
};
