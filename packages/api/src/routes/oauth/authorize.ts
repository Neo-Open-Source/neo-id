import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateToken, verifyAccessToken } from "@neo-id/auth-core";
import { error } from "../../helpers/response";
import { getAccessTokenFromRequest } from "../../helpers/auth-cookies";

export async function authorize(c: Context) {
  const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method } =
    c.req.query();

  if (!response_type || !client_id || !redirect_uri) {
    return error(c, "INVALID_REQUEST", "response_type, client_id, and redirect_uri are required");
  }

  if (response_type !== "code") {
    return error(c, "INVALID_REQUEST", "Only response_type=code is supported");
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
    return error(c, "NOT_FOUND", "Application not found", 404);
  }

  if (!serviceApp.isActive) {
    return error(c, "FORBIDDEN", "Application is disabled");
  }

  if (!serviceApp.redirectUris.includes(redirect_uri)) {
    return error(c, "INVALID_REQUEST", "Invalid redirect_uri");
  }

  let userId: string | null = null;
  const token = getAccessTokenFromRequest(c);
  if (token) {
    try {
      const payload = await verifyAccessToken(token);
      userId = payload.sub;
    } catch {
      // Not authenticated
    }
  }

  if (!userId) {
    const loginUrl = new URL("/login", c.req.url);
    loginUrl.searchParams.set("return_to", c.req.url);
    return c.redirect(loginUrl.toString(), 302);
  }

  const code = generateToken(32);

  await db.oAuthState.create({
    data: {
      state: state || generateToken(16),
      code,
      codeVerifier: code_challenge || null,
      codeChallenge: code_challenge_method === "S256" ? code_challenge : null,
      redirectUri: redirect_uri,
      serviceAppId: serviceApp.id,
      userId,
      mode: "authorize",
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    },
  });

  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return c.redirect(redirectUrl.toString(), 302);
}
