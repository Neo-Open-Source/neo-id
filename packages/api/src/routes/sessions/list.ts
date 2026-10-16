import type { Context } from "hono";
import { success } from "../../helpers/response";

export async function listSessions(c: Context) {
  const user = c.get("user");

  const sessions = await c.get("db").session.findMany({
    where: { userId: user.sub, isActive: true },
    select: {
      id: true,
      deviceInfo: true,
      ipAddress: true,
      location: true,
      createdAt: true,
      lastActiveAt: true,
    },
    orderBy: { lastActiveAt: "desc" },
  });

  return success(c, sessions);
}

export async function deleteSession(c: Context) {
  const user = c.get("user");
  const { id } = c.req.param();

  const session = await c.get("db").session.findFirst({
    where: { id, userId: user.sub },
  });

  if (!session) {
    return success(c, { ok: true });
  }

  await c.get("db").$executeRawUnsafe(
    `UPDATE "refresh_tokens" SET "revokedAt" = $2, "revokeReason" = $3 WHERE "sessionId" = $1`,
    id,
    new Date(),
    "session_revoked",
  );
  await c.get("db").session.delete({ where: { id } });

  return success(c, { ok: true });
}

export async function deleteAllSessions(c: Context) {
  const user = c.get("user");

  const activeSessions = await c.get("db").session.findMany({
    where: { userId: user.sub, isActive: true },
    select: { id: true },
  });

  const ids = activeSessions.map((s) => s.id);

  await c.get("db").$executeRawUnsafe(
    `UPDATE "refresh_tokens" SET "revokedAt" = $2, "revokeReason" = $3 WHERE "userId" = $1 AND "revokedAt" IS NULL`,
    user.sub,
    new Date(),
    "all_sessions_revoked",
  );
  if (ids.length > 0) {
    await c.get("db").$executeRawUnsafe(`DELETE FROM "sessions" WHERE "id" = ANY($1)`, ids);
  }

  return success(c, { ok: true });
}
