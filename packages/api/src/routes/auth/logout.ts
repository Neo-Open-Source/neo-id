import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verifyAccessToken } from "@neo-id/auth-core";
import { success } from "../../helpers/response";
import { clearAuthCookies, getAccessTokenFromRequest } from "../../helpers/auth-cookies";

export async function logout(c: Context) {
  const token = getAccessTokenFromRequest(c);
  if (token) {
    try {
      const user = await verifyAccessToken(token);
      await db.refreshToken.updateMany({
        where: { userId: user.sub, revokedAt: null },
        data: { revokedAt: new Date(), revokeReason: "logout" },
      });
      await db.session.updateMany({
        where: { userId: user.sub, isActive: true },
        data: { isActive: false },
      });
    } catch {
      // Expired/invalid token — still clear cookies
    }
  }

  clearAuthCookies(c);
  return success(c, { ok: true });
}
