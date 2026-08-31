import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";

export async function listIdentities(c: Context) {
  const user = c.get("user");

  const identities = await db.identity.findMany({
    where: { userId: user.sub },
    select: {
      id: true,
      provider: true,
      providerUserId: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return success(c, identities);
}

export async function disconnectIdentity(c: Context) {
  const user = c.get("user");
  const provider = c.req.param("provider");

  // Check if user has this identity
  const identity = await db.identity.findFirst({
    where: {
      userId: user.sub,
      provider,
    },
  });

  if (!identity) {
    return error(c, "NOT_FOUND", "Identity not found", 404);
  }

  // Check if user has a password or other identities (can't disconnect if it's the only login method)
  const userRecord = await db.user.findUnique({
    where: { id: user.sub },
    select: { passwordHash: true },
  });

  const identityCount = await db.identity.count({
    where: { userId: user.sub },
  });

  if (!userRecord?.passwordHash && identityCount <= 1) {
    return error(
      c,
      "FORBIDDEN",
      "Cannot disconnect your only login method. Set a password first."
    );
  }

  // Delete the identity
  await db.identity.delete({
    where: { id: identity.id },
  });

  return success(c, { disconnected: true, provider });
}
