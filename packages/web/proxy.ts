import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "uk", "ro", "ru"];

const AUTH_ROUTES = new Set([
  "/profile", "/sessions", "/connected", "/setup",
  "/admin", "/developer",
]);

function isAuthRoute(pathname: string): boolean {
  return AUTH_ROUTES.has(pathname) ||
    pathname.startsWith("/profile/") ||
    pathname.startsWith("/sessions/") ||
    pathname.startsWith("/connected/") ||
    pathname.startsWith("/setup/") ||
    pathname.startsWith("/admin/") ||
    pathname.startsWith("/developer/");
}

function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get("neo_id_locale")?.value;
  if (cookie && locales.includes(cookie)) return cookie;

  const acceptLang = request.headers.get("Accept-Language") || "";
  if (acceptLang.startsWith("uk")) return "uk";
  if (acceptLang.startsWith("ro")) return "ro";
  if (acceptLang.startsWith("ru")) return "ru";

  return "en";
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = detectLocale(request);

  if (pathname === "/") {
    const hasAccess = !!request.cookies.get("neo_id_access")?.value;
    const hasRefresh = !!request.cookies.get("neo_id_refresh")?.value;
    const hasSession = hasAccess || hasRefresh;
    if (hasSession) {
      return NextResponse.redirect(new URL("/profile", request.url));
    }
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  if (isAuthRoute(pathname)) {
    const hasAccess = !!request.cookies.get("neo_id_access")?.value;
    const hasRefresh = !!request.cookies.get("neo_id_refresh")?.value;
    if (!hasAccess && !hasRefresh) {
      const loginUrl = new URL("/auth", request.url);
      loginUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  if (pathname === "/auth") {
    const hasAccess = !!request.cookies.get("neo_id_access")?.value;
    const hasSession = hasAccess || !!request.cookies.get("neo_id_refresh")?.value;
    if (hasSession) {
      return NextResponse.redirect(new URL("/profile", request.url));
    }
  }

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: "/((?!api|_next|favicon|fonts).*)",
};
