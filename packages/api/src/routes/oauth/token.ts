import type { Context } from "hono";
import { db } from "@neo-id/db";
import {
  signAccessToken,
  signIdToken,
  generateToken,
  hashToken,
} from "@neo-id/auth-core";
import { TOKEN } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function token(c: Context) {
  const body = await c.req.json();
  const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token } = body;

  // ─── Authorization Code Grant ─────────────────────────────────────────────
  if (grant_type === "authorization_code") {
    if (!code || !redirect_uri || !client_id) {
      return error(c, "INVALID_REQUEST", "code, redirect_uri, and client_id are required");
    }

    // Find service app
    const serviceApp = await db.serviceApp.findUnique({
      where: { clientId: client_id },
      select: { id: true, clientSecretHash: true, isActive: true },
    });

    if (!serviceApp || !serviceApp.isActive) {
      return error(c, "INVALID_REQUEST", "Invalid client_id");
    }

    // Verify client secret (if set)
    if (serviceApp.clientSecretHash && client_secret) {
      const { verify } = await import("@neo-id/auth-core");
      const valid = await verify(client_secret, serviceApp.clientSecretHash);
      if (!valid) {
        return error(c, "INVALID_REQUEST", "Invalid client_secret");
      }
    }

    // Find OAuth state
    const oauthState = await db.oAuthState.findFirst({
      where: {
        serviceAppId: serviceApp.id,
        redirectUri: redirect_uri,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!oauthState) {
      return error(c, "INVALID_REQUEST", "Invalid or expired authorization code");
    }

    // Delete used state
    await db.oAuthState.delete({ where: { id: oauthState.id } });

    // Get user
    const user = await db.user.findUnique({
      where: { id: oauthState.userId! },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status === "banned") {
      return error(c, "INVALID_REQUEST", "User not found or banned");
    }

    // Create session
    const session = await db.session.create({
      data: {
        userId: user.id,
        deviceInfo: c.req.header("User-Agent"),
        ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      },
    });

    // Generate tokens
    const accessToken = await signAccessToken(
      { sub: user.id, email: user.email, role: user.role },
      session.id
    );
    const idToken = await signIdToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Create refresh token
    const newRefreshToken = generateToken(TOKEN.REFRESH_TOKEN_LENGTH);
    await db.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashToken(newRefreshToken),
        deviceInfo: c.req.header("User-Agent"),
        ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
        expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
      },
    });

    return success(c, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: TOKEN.ACCESS_TOKEN_EXPIRY,
      refresh_token: newRefreshToken,
      id_token: idToken,
    });
  }

  // ─── Refresh Token Grant ──────────────────────────────────────────────────
  if (grant_type === "refresh_token") {
    if (!refresh_token || !client_id) {
      return error(c, "INVALID_REQUEST", "refresh_token and client_id are required");
    }

    // Find refresh token
    const tokenHash = hashToken(refresh_token);
    const storedToken = await db.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!storedToken || storedToken.revokedAt) {
      return error(c, "INVALID_REQUEST", "Invalid refresh token");
    }

    if (storedToken.expiresAt < new Date()) {
      return error(c, "INVALID_REQUEST", "Refresh token expired");
    }

    const user = storedToken.user;
    if (user.status === "banned") {
      return error(c, "INVALID_REQUEST", "User banned");
    }

    // Revoke old token
    await db.refreshToken.update({
      where: { id: storedToken.id },
      data: { revokedAt: new Date(), revokeReason: "rotated" },
    });

    // Create new session
    const session = await db.session.create({
      data: {
        userId: user.id,
        deviceInfo: storedToken.deviceInfo,
        ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      },
    });

    // Generate new tokens
    const accessToken = await signAccessToken(
      { sub: user.id, email: user.email, role: user.role },
      session.id
    );
    const idToken = await signIdToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });

    // Create new refresh token
    const newRefreshToken = generateToken(TOKEN.REFRESH_TOKEN_LENGTH);
    await db.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash: hashToken(newRefreshToken),
        parentId: storedToken.id,
        deviceInfo: storedToken.deviceInfo,
        ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
        expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
      },
    });

    return success(c, {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: TOKEN.ACCESS_TOKEN_EXPIRY,
      refresh_token: newRefreshToken,
      id_token: idToken,
    });
  }

  return error(c, "INVALID_REQUEST", `Unsupported grant_type: ${grant_type}`);
}
