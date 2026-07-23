import type { Context } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { TOKEN } from "@neo-id/shared";

export const ACCESS_COOKIE = "neo_id_access";
export const REFRESH_COOKIE = "neo_id_refresh";

const isProd = process.env.NODE_ENV === "production";

function baseCookieOpts() {
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax" as const,
    path: "/",
  };
}

export function setAuthCookies(
  c: Context,
  tokens: { accessToken: string; refreshToken: string },
) {
  setCookie(c, ACCESS_COOKIE, tokens.accessToken, {
    ...baseCookieOpts(),
    maxAge: TOKEN.ACCESS_TOKEN_EXPIRY,
  });
  setCookie(c, REFRESH_COOKIE, tokens.refreshToken, {
    ...baseCookieOpts(),
    // Narrow path: refresh/logout only
    path: "/api/v1/auth",
    maxAge: TOKEN.REFRESH_TOKEN_EXPIRY,
  });
}

export function clearAuthCookies(c: Context) {
  deleteCookie(c, ACCESS_COOKIE, { path: "/" });
  deleteCookie(c, REFRESH_COOKIE, { path: "/api/v1/auth" });
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
