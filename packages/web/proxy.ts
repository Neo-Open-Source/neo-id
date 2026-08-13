import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const locales = ["en", "uk", "ro", "ru"];

function detectLocale(request: NextRequest): string {
  const cookie = request.cookies.get("neo_id_locale")?.value;
  if (cookie && locales.includes(cookie)) return cookie;

  const acceptLang = request.headers.get("Accept-Language") || "";
  if (acceptLang.startsWith("uk")) return "uk";
  if (acceptLang.startsWith("ro")) return "ro";
  if (acceptLang.startsWith("ru")) return "ru";

  return "en";
}

function hasAuthCookies(request: NextRequest): boolean {
  return (
    !!request.cookies.get("neo_id_access")?.value ||
    !!request.cookies.get("neo_id_refresh")?.value
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const locale = detectLocale(request);
  const authed = hasAuthCookies(request);

  // Soft routing only. Do NOT hard-block /profile without cookies:
  // refresh may live in localStorage when Set-Cookie was dropped, and the
  // client rehydrates via POST /auth/refresh before loading the profile.
  if (pathname === "/") {
    return NextResponse.redirect(new URL(authed ? "/profile" : "/auth", request.url));
  }

  // Only bounce away from /auth when cookies prove a session. Client-side
  // ensureSession handles the localStorage-only case.
  //
  // Do NOT edge-redirect OAuth returns (/auth?redirect=/api/v1/oauth/...).
  // Access JWT may be expired while refresh cookie still exists — bouncing
  // straight to authorize without a client refresh causes:
  //   /auth → authorize (401/no user) → /auth → … redirect loop.
  // The auth page refreshes the session, then window.location.assign(redirect).
  if (pathname === "/auth" && authed) {
    const redirect = request.nextUrl.searchParams.get("redirect");
    if (redirect?.startsWith("/api/")) {
      const response = NextResponse.next();
      response.headers.set("x-locale", locale);
      return response;
    }
    return NextResponse.redirect(new URL("/profile", request.url));
  }

  const response = NextResponse.next();
  response.headers.set("x-locale", locale);
  return response;
}

export const config = {
  matcher: "/((?!api|_next|favicon|fonts).*)",
};
