import type { Context } from "hono";
import { db } from "@neo-id/db";
import { requireAuth } from "../../middleware/auth";
import { success, error } from "../../helpers/response";

export async function listPasskeys(c: Context) {
  const user = c.get("user");

  const passkeys = await db.passkey.findMany({
    where: { userId: user.sub },
    select: {
      id: true,
      credentialId: true,
      deviceName: true,
      createdAt: true,
      lastUsedAt: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return success(c, passkeys);
}

export async function deletePasskey(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();

  if (!id) {
    return error(c, "INVALID_REQUEST", "Passkey ID is required");
  }

  const passkey = await db.passkey.findFirst({
    where: { id, userId: user.sub },
  });

  if (!passkey) {
    return error(c, "NOT_FOUND", "Passkey not found", 404);
  }

  await db.passkey.delete({ where: { id } });

  return success(c, { ok: true });
}
