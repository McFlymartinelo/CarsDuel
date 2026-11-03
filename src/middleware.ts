import { NextResponse, type NextRequest } from "next/server";

// Garde-fou léger (Edge, pas d'accès base) : présence du cookie de session.
// Ce n'est pas une authentification. requireUser() (session relue en base) fait foi.
const PUBLIC_PATHS = new Set(["/sw.js", "/api/push/vapid", "/api/push/dispatch"]);

export function middleware(request: NextRequest) {
  const hasSession = request.cookies.has("gb_session");
  const { pathname } = request.nextUrl;
  const isAuthRoute = pathname.startsWith("/auth");

  if (!hasSession && !isAuthRoute && !PUBLIC_PATHS.has(pathname)) {
    return NextResponse.redirect(new URL("/auth/login", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
