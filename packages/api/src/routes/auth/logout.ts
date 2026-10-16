import type { Context } from "hono";
import { hashToken, verifyAccessToken } from "@neo-id/auth-core";
import { success } from "../../helpers/response";
import {
  clearAuthCookies,
  getAccessTokenFromRequest,
  getRefreshTokenFromRequest,
} from "../../helpers/auth-cookies";

export async function logout(c: Context) {
  // Prefer access token; fall back to refresh so expired access still ends the session.
  const accessToken = getAccessTokenFromRequest(c);
  let userId: string | null = null;
  let sessionId: string | null = null;

  if (accessToken) {
    try {
      const user = await verifyAccessToken(accessToken);
      userId = user.sub;
      sessionId = user.session_id ?? null;
    } catch {
      // expired/invalid access — try refresh cookie below
    }
  }

  if (!userId) {
    const refreshToken = getRefreshTokenFromRequest(c);
    if (refreshToken) {
      const stored = await c.get("db").refreshToken.findUnique({
        where: { tokenHash: hashToken(refreshToken) },
      });
      if (stored) {
        userId = stored.userId;
        sessionId = stored.sessionId;
      }
    }
  }

  if (userId) {
    if (sessionId) {
      await c.get("db").$executeRawUnsafe(
        `UPDATE "refresh_tokens" SET "revokedAt" = $2, "revokeReason" = $3 WHERE "sessionId" = $1 AND "revokedAt" IS NULL`,
        sessionId,
        new Date(),
        "logout",
      );
      await c.get("db").$executeRawUnsafe(`UPDATE "sessions" SET "isActive" = false WHERE "id" = $1 AND "isActive" = true`, sessionId);
    } else {
      await c.get("db").$executeRawUnsafe(
        `UPDATE "refresh_tokens" SET "revokedAt" = $2, "revokeReason" = $3 WHERE "userId" = $1 AND "revokedAt" IS NULL`,
        userId,
        new Date(),
        "logout",
      );
      await c.get("db").$executeRawUnsafe(`UPDATE "sessions" SET "isActive" = false WHERE "userId" = $1 AND "isActive" = true`, userId);
    }
  }

  clearAuthCookies(c);
  return success(c, { ok: true });
}
