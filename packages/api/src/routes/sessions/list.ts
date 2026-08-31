import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success } from "../../helpers/response";

export async function listSessions(c: Context) {
  const user = c.get("user");

  const sessions = await db.session.findMany({
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

  const session = await db.session.findFirst({
    where: { id, userId: user.sub },
  });

  if (!session) {
    return success(c, { ok: true });
  }

  await db.$transaction([
    db.refreshToken.updateMany({
      where: { sessionId: id },
      data: { revokedAt: new Date(), revokeReason: "session_revoked" },
    }),
    db.session.delete({ where: { id } }),
  ]);

  return success(c, { ok: true });
}

export async function deleteAllSessions(c: Context) {
  const user = c.get("user");

  const activeSessions = await db.session.findMany({
    where: { userId: user.sub, isActive: true },
    select: { id: true },
  });

  const ids = activeSessions.map((s) => s.id);

  await db.$transaction([
    db.refreshToken.updateMany({
      where: { userId: user.sub, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "all_sessions_revoked" },
    }),
    ...(ids.length > 0
      ? [db.session.deleteMany({ where: { id: { in: ids } } })]
      : []),
  ]);

  return success(c, { ok: true });
}
