import type { Context } from "hono";
import { db } from "@neo-id/db";
import { USER, updateProfileSchema } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { validate } from "../../helpers/request";

export async function getProfile(c: Context) {
  const user = c.get("user");

  const [profile, hasPassword, passkeyCount, connectionCount] = await Promise.all([
    db.user.findUnique({
      where: { id: user.sub },
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
        totpEnabled: true,
        emailMfaEnabled: true,
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
        identities: {
          select: {
            id: true,
            provider: true,
            createdAt: true,
          },
        },
      },
    }),
    db.user.findUnique({
      where: { id: user.sub },
      select: { passwordHash: true },
    }).then((u) => !!u?.passwordHash),
    db.passkey.count({ where: { userId: user.sub } }),
    db.authorizedConnection.count({ where: { userId: user.sub } }),
  ]);

  if (!profile) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  return success(c, {
    ...profile,
    hasPassword,
    passkeyCount,
    connectionCount,
  });
}

export async function checkUsername(c: Context) {
  const user = c.get("user");
  const username = String(c.req.query("username") || "").trim();

  if (!username) {
    return success(c, { available: false, reason: "empty" as const });
  }

  if (
    username.length < USER.USERNAME_MIN ||
    username.length > USER.USERNAME_MAX ||
    !USER.USERNAME_REGEX.test(username)
  ) {
    return success(c, { available: false, reason: "invalid" as const });
  }

  // Current username is always "available" for this user
  const me = await db.user.findUnique({
    where: { id: user.sub },
    select: { username: true },
  });
  if (me?.username && me.username.toLowerCase() === username.toLowerCase()) {
    return success(c, { available: true, reason: "ok" as const });
  }

  const existing = await db.user.findFirst({
    where: {
      username,
      NOT: { id: user.sub },
    },
    select: { id: true },
  });

  return success(c, {
    available: !existing,
    reason: existing ? ("taken" as const) : ("ok" as const),
  });
}

export async function updateProfile(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = validate(updateProfileSchema, body);
  if (!parsed.success) return error(c, "INVALID_REQUEST", parsed.error);

  const data = parsed.data;

  if (data.username) {
    const taken = await db.user.findFirst({
      where: {
        username: data.username,
        NOT: { id: user.sub },
      },
      select: { id: true },
    });
    if (taken) {
      return error(c, "USERNAME_TAKEN", "Username is already taken", 409);
    }
  }

  const updated = await db.user.update({
    where: { id: user.sub },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
      ...(data.username !== undefined && {
        username: data.username === "" ? null : data.username,
      }),
    },
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
      username: true,
    },
  });

  return success(c, updated);
}
