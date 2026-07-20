import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateToken } from "@neo-id/auth-core";
import { error } from "../../helpers/response";

export async function authorize(c: Context) {
  const { response_type, client_id, redirect_uri, state, code_challenge, code_challenge_method } =
    c.req.query();

  // Validate required params
  if (!response_type || !client_id || !redirect_uri) {
    return error(c, "INVALID_REQUEST", "response_type, client_id, and redirect_uri are required");
  }

  if (response_type !== "code") {
    return error(c, "INVALID_REQUEST", "Only response_type=code is supported");
  }

  // Find service app
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

  // Validate redirect URI
  if (!serviceApp.redirectUris.includes(redirect_uri)) {
    return error(c, "INVALID_REQUEST", "Invalid redirect_uri");
  }

  // Check if user is authenticated
  const authHeader = c.req.header("Authorization");
  let userId: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    try {
      const { verifyAccessToken } = await import("@neo-id/auth-core");
      const payload = await verifyAccessToken(authHeader.slice(7));
      userId = payload.sub;
    } catch {
      // Not authenticated
    }
  }

  // If not authenticated, redirect to login with return URL
  if (!userId) {
    const loginUrl = new URL("/login", c.req.url);
    loginUrl.searchParams.set("return_to", c.req.url);
    return c.redirect(loginUrl.toString(), 302);
  }

  // Generate authorization code
  const code = generateToken(32);

  // Store OAuth state
  await db.oAuthState.create({
    data: {
      state: state || generateToken(16),
      codeVerifier: code_challenge || null,
      codeChallenge: code_challenge_method === "S256" ? code_challenge : null,
      redirectUri: redirect_uri,
      serviceAppId: serviceApp.id,
      userId,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
    },
  });

  // Redirect back to client with code
  const redirectUrl = new URL(redirect_uri);
  redirectUrl.searchParams.set("code", code);
  if (state) {
    redirectUrl.searchParams.set("state", state);
  }

  return c.redirect(redirectUrl.toString(), 302);
}
