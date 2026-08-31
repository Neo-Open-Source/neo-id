import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { TOKEN } from "@neo-id/shared";

export const ACCESS_COOKIE = "neo_id_access";
export const REFRESH_COOKIE = "neo_id_refresh";

function baseCookieOpts() {
  // Always Secure on HTTPS production hosts; NODE_ENV alone can lag behind
  // reverse-proxy deployments and cause browsers to drop cookies.
  const secure =
    process.env.NODE_ENV === "production" ||
    process.env.COOKIE_SECURE === "true" ||
    process.env.VERCEL === "1";

  return {
    httpOnly: true,
    secure,
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function setAuthCookies(
  c: Context,
  tokens: { accessToken: string; refreshToken: string },
) {
  const opts = baseCookieOpts();
  // Cookie lifetime must outlive the JWT access expiry so a closed tab
  // can still rehydrate the session via refresh after 15+ minutes.
  const maxAge = TOKEN.REFRESH_TOKEN_EXPIRY;

  setCookie(c, ACCESS_COOKIE, tokens.accessToken, { ...opts, maxAge });
  setCookie(c, REFRESH_COOKIE, tokens.refreshToken, { ...opts, maxAge });
}

export function clearAuthCookies(c: Context) {
  const opts = baseCookieOpts();
  // Match attributes used when setting, otherwise some browsers keep the cookie.
  deleteCookie(c, ACCESS_COOKIE, { path: "/", secure: opts.secure, sameSite: opts.sameSite });
  deleteCookie(c, REFRESH_COOKIE, { path: "/", secure: opts.secure, sameSite: opts.sameSite });
}

export function getAccessTokenFromRequest(c: Context): string | null {
  const authHeader = c.req.header("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7);
  }
  return getCookie(c, ACCESS_COOKIE) || null;
}

export function getRefreshTokenFromRequest(c: Context, bodyToken?: string): string | null {
  if (bodyToken) return bodyToken;
  return getCookie(c, REFRESH_COOKIE) || null;
}
