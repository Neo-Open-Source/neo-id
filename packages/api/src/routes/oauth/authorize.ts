import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateToken, verifyAccessToken } from "@neo-id/auth-core";
import { error } from "../../helpers/response";
import {
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
  setAuthCookies,
} from "../../helpers/auth-cookies";
import { getRequestInfo } from "../../helpers/request";
import { verifyAndRotateRefreshToken } from "../../helpers/tokens";

function normalizeRedirectUri(uri: string): string {
  return uri.trim().replace(/\/+$/, "");
}

function redirectUrisMatch(registered: string[], incoming: string): boolean {
  const target = normalizeRedirectUri(incoming);
  return registered.some((u) => normalizeRedirectUri(u) === target);
}

/** Browser navigations should not get opaque JSON — show a short HTML error. */
function authorizeError(c: Context, code: "INVALID_REQUEST" | "NOT_FOUND" | "FORBIDDEN", message: string, status: 400 | 403 | 404 = 400) {
  const accept = c.req.header("Accept") || "";
  if (accept.includes("text/html")) {
    return c.html(
      `<!doctype html><html><head><meta charset="utf-8"/><title>OAuth error</title>
      <style>body{font-family:system-ui,sans-serif;background:#111;color:#eee;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px}
      .box{max-width:520px;background:#1c1c1c;border:1px solid #333;border-radius:16px;padding:28px}
      h1{font-size:18px;margin:0 0 12px}p{margin:0;color:#aaa;line-height:1.5;white-space:pre-wrap}code{color:#fff}</style></head>
      <body><div class="box"><h1>${code}</h1><p>${message.replace(/</g, "&lt;")}</p></div></body></html>`,
      status,
    );
  }
  return error(c, code, message, status);
}

export async function authorize(c: Context) {
  const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method } =
    c.req.query();

  if (!response_type || !client_id || !redirect_uri) {
    return authorizeError(c, "INVALID_REQUEST", "response_type, client_id, and redirect_uri are required");
  }

  if (response_type !== "code") {
    return authorizeError(c, "INVALID_REQUEST", "Only response_type=code is supported");
  }

  const serviceApp = await db.serviceApp.findUnique({
    where: { clientId: client_id },
    select: {
      id: true,
      clientId: true,
      name: true,
      displayName: true,
      logoUrl: true,
      redirectUris: true,
      allowedScopes: true,
      isActive: true,
    },
  });

  if (!serviceApp) {
    return authorizeError(c, "NOT_FOUND", "Application not found", 404);
  }

  if (!serviceApp.isActive) {
    return authorizeError(c, "FORBIDDEN", "Application is disabled", 403);
  }

  if (!redirectUrisMatch(serviceApp.redirectUris, redirect_uri)) {
    const listed = serviceApp.redirectUris.map((u) => `• ${u}`).join("\n") || "• (none configured)";
    return authorizeError(
      c,
      "INVALID_REQUEST",
      `Invalid redirect_uri.\n\nReceived:\n${redirect_uri}\n\nAllowed for this app:\n${listed}\n\nAdd this exact URI in Neo ID → Developer → your app → Redirect URIs.`,
    );
  }

  let userId: string | null = null;
  let sessionId: string | null = null;
  const token = getAccessTokenFromRequest(c);
  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      userId = payload.sub;
      sessionId = payload.session_id || null;
    } catch {
      // Access JWT expired / invalid — try refresh cookie below
    }
  }

  // Browser OAuth is cookie-only (no Authorization header). Access JWT lasts
  // ~15m while refresh lives 30d — without this, a still-logged-in user gets
  // bounced /auth ↔ authorize forever when the edge/proxy skips client refresh.
  if (!userId) {
    const refreshToken = getRefreshTokenFromRequest(c);
    if (refreshToken) {
      const result = await verifyAndRotateRefreshToken(
        refreshToken,
        undefined,
        getRequestInfo(c).ipAddress,
      );
      if (result.ok) {
        setAuthCookies(c, result.tokens);
        userId = result.user.id;
        sessionId = result.tokens.sessionId;
      }
    }
  }

  if (!userId) {
    // Full authorize URL as relative path so /auth can send the browser back here.
    // encodeURIComponent the whole value so nested ? & = stay inside `redirect`
    // (and existing %xx in redirect_uri become %25xx — one decode restores them).
    const authorizePath = `${new URL(c.req.url).pathname}${new URL(c.req.url).search}`;
    const loginUrl = new URL("/auth", c.req.url);
    loginUrl.searchParams.set("redirect", authorizePath);
    return c.redirect(loginUrl.toString(), 302);
  }

  // Always show consent — create pending session then open the consent UI
  const pendingState = await db.oAuthState.create({
    data: {
      state: state || generateToken(16),
      code: null,
      // NOTE: `codeVerifier` historically stores the *challenge* (the raw
      // verifier never leaves the client). token.ts reads
      // `codeChallenge || codeVerifier` to tolerate the legacy naming.
      codeVerifier: code_challenge || null,
      codeChallenge: code_challenge_method === "S256" ? code_challenge : null,
      redirectUri: redirect_uri,
      serviceAppId: serviceApp.id,
      userId,
      sessionId,
      mode: "pending",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const consentUrl = new URL("/auth/oauth/consent", c.req.url);
  consentUrl.searchParams.set("session", pendingState.id);

  return c.redirect(consentUrl.toString(), 302);
}
