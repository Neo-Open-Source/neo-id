import type { Context } from "hono";
import { db } from "@neo-id/db";
import { hash, verify } from "@neo-id/auth-core";
import { changePasswordSchema } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { validate } from "../../helpers/request";

export async function changePassword(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = validate(changePasswordSchema, body);
  if (!parsed.success) return error(c, "INVALID_REQUEST", parsed.error);

  const { currentPassword, newPassword } = parsed.data;

  // Get current password hash
  const currentUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { passwordHash: true },
  });

  if (!currentUser?.passwordHash) {
    return error(c, "INVALID_REQUEST", "No password set. Use a connected account.");
  }

  // Verify current password
  const valid = await verify(currentPassword, currentUser.passwordHash);
  if (!valid) {
    return error(c, "INVALID_CREDENTIALS", "Current password is incorrect");
  }

  // Hash new password
  const newHash = await hash(newPassword);

  // Update password and revoke all other sessions
  await db.user.update({
    where: { id: user.sub },
    data: { passwordHash: newHash },
  });

  // Revoke all other refresh tokens
  await db.refreshToken.updateMany({
    where: {
      userId: user.sub,
      revokedAt: null,
    },
    data: { revokedAt: new Date(), revokeReason: "password_changed" },
  });

  return success(c, { ok: true });
}
