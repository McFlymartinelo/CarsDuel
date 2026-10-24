import { NextResponse, type NextRequest } from "next/server";

// Garde-fou léger (Edge, pas d'accès base) : présence du cookie de session.
// La validité réelle de la session est vérifiée côté serveur par requireUser().
export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("gb_session");
  const isAuthRoute = request.nextUrl.pathname.startsWith("/auth");

  if (!hasSession && !isAuthRoute) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
