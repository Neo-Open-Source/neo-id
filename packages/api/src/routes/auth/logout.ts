import type { Context } from "hono";
import { db } from "@neo-id/db";
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
      const stored = await db.refreshToken.findUnique({
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
      await db.refreshToken.updateMany({
        where: { sessionId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "logout" },
      });
      await db.session.updateMany({
        where: { id: sessionId, isActive: true },
        data: { isActive: false },
      });
    } else {
      await db.refreshToken.updateMany({
        where: { userId, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "logout" },
      });
      await db.session.updateMany({
        where: { userId, isActive: true },
        data: { isActive: false },
      });
    }
  }

  clearAuthCookies(c);
  return success(c, { ok: true });
}
