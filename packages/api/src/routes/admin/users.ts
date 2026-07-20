import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";

export async function listUsers(c: Context) {
  const { page = "1", limit = "20", search } = c.req.query();
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const where = search
    ? {
        OR: [
          { email: { contains: search, mode: "insensitive" as const } },
          { username: { contains: search, mode: "insensitive" as const } },
          { displayName: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      select: {
        id: true,
        email: true,
        username: true,
        displayName: true,
        avatar: true,
        role: true,
        status: true,
        totpEnabled: true,
        emailMfaEnabled: true,
        createdAt: true,
        lastLoginAt: true,
        _count: {
          select: {
            passkeys: true,
            sessions: { where: { isActive: true } },
          },
        },
      },
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
    }),
    db.user.count({ where }),
  ]);

  return success(c, {
    users: users.map((u) => ({
      ...u,
      passkeyCount: u._count.passkeys,
      sessionCount: u._count.sessions,
      _count: undefined,
    })),
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}

export async function getUser(c: Context) {
  const { id } = c.req.param();

  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      emailVerified: true,
      username: true,
      displayName: true,
      firstName: true,
      lastName: true,
      avatar: true,
      role: true,
      status: true,
      totpEnabled: true,
      emailMfaEnabled: true,
      createdAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
      identities: {
        select: { provider: true, createdAt: true },
      },
      _count: {
        select: {
          passkeys: true,
          sessions: { where: { isActive: true } },
        },
      },
    },
  });

  if (!user) {
    return error(c, "NOT_FOUND", "User not found", 404);
  }

  return success(c, {
    ...user,
    passkeyCount: user._count.passkeys,
    sessionCount: user._count.sessions,
    _count: undefined,
  });
}

export async function banUser(c: Context) {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { banned, reason } = body;

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!user) {
    return error(c, "NOT_FOUND", "User not found", 404);
  }

  if (user.role === "admin") {
    return error(c, "FORBIDDEN", "Cannot ban admin users");
  }

  await db.user.update({
    where: { id },
    data: { status: banned ? "banned" : "active" },
  });

  // If banning, revoke all sessions and tokens
  if (banned) {
    await db.session.updateMany({
      where: { userId: id, isActive: true },
      data: { isActive: false },
    });
    await db.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date(), revokeReason: "admin_ban" },
    });
  }

  // Log audit
  const admin = (c as any).get("user");
  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: banned ? "user.ban" : "user.unban",
      targetId: id,
      details: { reason },
    },
  });

  return success(c, { ok: true });
}

export async function setRole(c: Context) {
  const { id } = c.req.param();
  const body = await c.req.json();
  const { role } = body;

  if (!["user", "developer", "admin"].includes(role)) {
    return error(c, "INVALID_REQUEST", "Invalid role");
  }

  const user = await db.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });

  if (!user) {
    return error(c, "NOT_FOUND", "User not found", 404);
  }

  await db.user.update({
    where: { id },
    data: { role },
  });

  // Log audit
  const admin = (c as any).get("user");
  await db.auditLog.create({
    data: {
      actorId: admin.sub,
      actorEmail: admin.email,
      action: "user.role_change",
      targetId: id,
      details: { from: user.role, to: role },
    },
  });

  return success(c, { ok: true });
}

export async function getStats(c: Context) {
  const [
    totalUsers,
    activeUsers,
    mfaEnabled,
    oauthConnected,
    totalServices,
    recentLogins,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { status: "active" } }),
    db.user.count({ where: { OR: [{ totpEnabled: true }, { emailMfaEnabled: true }] } }),
    db.identity.count(),
    db.serviceApp.count(),
    db.user.count({
      where: {
        lastLoginAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    }),
  ]);

  return success(c, {
    totalUsers,
    activeUsers,
    mfaEnabled,
    oauthConnected,
    totalServices,
    recentLogins,
  });
}

export async function getAuditLogs(c: Context) {
  const { page = "1", limit = "50" } = c.req.query();
  const pageNum = parseInt(page, 10);
  const limitNum = parseInt(limit, 10);
  const skip = (pageNum - 1) * limitNum;

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      skip,
      take: limitNum,
      orderBy: { createdAt: "desc" },
    }),
    db.auditLog.count(),
  ]);

  return success(c, {
    logs,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      pages: Math.ceil(total / limitNum),
    },
  });
}
