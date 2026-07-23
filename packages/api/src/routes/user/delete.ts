import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verify } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";

export async function deleteAccount(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { password } = body;

  // Fetch user to check if they have a password
  const userRecord = await db.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true,
      passwordHash: true,
      role: true,
    },
  });

  if (!userRecord) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  // If user has a password, require it for confirmation
  if (userRecord.passwordHash) {
    if (!password) {
      return error(c, "INVALID_REQUEST", "Password required to delete account");
    }

    const valid = await verify(password, userRecord.passwordHash);
    if (!valid) {
      return error(c, "INVALID_CREDENTIALS", "Invalid password");
    }
  }

  // Prevent admin from deleting themselves (optional safeguard)
  if (userRecord.role === "admin") {
    const adminCount = await db.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return error(c, "FORBIDDEN", "Cannot delete the last admin account");
    }
  }

  // Delete user and all related data (cascade)
  await db.user.delete({ where: { id: user.sub } });

  return success(c, { deleted: true });
}
