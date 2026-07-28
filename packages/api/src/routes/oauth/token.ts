import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verify } from "@neo-id/auth-core";
import { TOKEN } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { issueTokens, verifyAndRotateRefreshToken } from "../../helpers/tokens";
import { getRequestInfo } from "../../helpers/request";

export async function token(c: Context) {
  const body = await c.req.json();
  const { grant_type, code, redirect_uri, client_id, client_secret, refresh_token } = body;
  const { deviceInfo, ipAddress } = getRequestInfo(c);

  // ─── Authorization Code Grant ─────────────────────────────────────────────
  if (grant_type === "authorization_code") {
    if (!code || !redirect_uri || !client_id) {
      return error(c, "INVALID_REQUEST", "code, redirect_uri, and client_id are required");
    }

    const serviceApp = await db.serviceApp.findUnique({
      where: { clientId: client_id },
      select: { id: true, clientSecretHash: true, isActive: true },
    });

    if (!serviceApp || !serviceApp.isActive) {
      return error(c, "INVALID_REQUEST", "Invalid client_id");
    }

    if (serviceApp.clientSecretHash && client_secret) {
      const valid = await verify(client_secret, serviceApp.clientSecretHash);
      if (!valid) {
        return error(c, "INVALID_REQUEST", "Invalid client_secret");
      }
    }

    const oauthState = await db.oAuthState.findFirst({
      where: {
        code,
        serviceAppId: serviceApp.id,
        redirectUri: redirect_uri,
        mode: "authorize",
        expiresAt: { gte: new Date() },
      },
    });

    if (!oauthState || !oauthState.userId || !oauthState.code) {
      return error(c, "INVALID_REQUEST", "Invalid or expired authorization code");
    }

    await db.oAuthState.delete({ where: { id: oauthState.id } });

    await db.authorizedConnection.upsert({
      where: {
        userId_serviceAppId: {
          userId: oauthState.userId,
          serviceAppId: serviceApp.id,
        },
      },
      create: {
        userId: oauthState.userId,
        serviceAppId: serviceApp.id,
        scopes: ["openid", "profile", "email"],
      },
      update: {
        lastUsedAt: new Date(),
      },
    });

    const user = await db.user.findUnique({
      where: { id: oauthState.userId },
      select: { id: true, email: true, role: true, status: true },
    });

    if (!user || user.status === "banned") {
      return error(c, "INVALID_REQUEST", "User not found or banned");
    }

    const tokens = await issueTokens({ userId: user.id, email: user.email, role: user.role, deviceInfo, ipAddress });

    return success(c, {
      access_token: tokens.accessToken,
      token_type: "Bearer",
      expires_in: TOKEN.ACCESS_TOKEN_EXPIRY,
      refresh_token: tokens.refreshToken,
      id_token: tokens.idToken,
    });
  }

  // ─── Refresh Token Grant ──────────────────────────────────────────────────
  if (grant_type === "refresh_token") {
    if (!refresh_token || !client_id) {
      return error(c, "INVALID_REQUEST", "refresh_token and client_id are required");
    }

    const result = await verifyAndRotateRefreshToken(refresh_token as string, deviceInfo, ipAddress);

    if (!result.ok) {
      return error(c, "INVALID_REQUEST", result.message);
    }

    return success(c, {
      access_token: result.tokens.accessToken,
      token_type: "Bearer",
      expires_in: TOKEN.ACCESS_TOKEN_EXPIRY,
      refresh_token: result.tokens.refreshToken,
      id_token: result.tokens.idToken,
    });
  }

  return error(c, "INVALID_REQUEST", `Unsupported grant_type: ${grant_type}`);
}
