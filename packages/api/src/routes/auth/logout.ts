import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success } from "../../helpers/response";

export async function logout(c: Context) {
  // Get token from header
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return success(c, { ok: true });
  }

  // Find and revoke all refresh tokens for this session
  // For now, revoke all tokens for the user
  const user = c.get("user");
  if (user) {
    await db.refreshToken.updateMany({
      where: { userId: user.sub, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "logout" },
    });

    await db.session.updateMany({
      where: { userId: user.sub, isActive: true },
      data: { isActive: false },
    });
  }

  return success(c, { ok: true });
}
