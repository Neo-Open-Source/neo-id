import type { Context } from "hono";
import { db } from "@neo-id/db";
import { requireAuth } from "../../middleware/auth";
import { updateProfileSchema, type UpdateProfileInput } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function getProfile(c: Context) {
  const user = c.get("user");

  const profile = await db.user.findUnique({
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
      passwordHash: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      identities: {
        select: {
          provider: true,
          providerUserId: true,
          createdAt: true,
        },
      },
    },
  });

  if (!profile) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  return success(c, {
    ...profile,
    hasPassword: !!profile.passwordHash,
    passwordHash: undefined,
  });
}

export async function updateProfile(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = updateProfileSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, "INVALID_REQUEST", parsed.error.errors[0]?.message || "Invalid input");
  }

  const data = parsed.data as UpdateProfileInput;

  const updated = await db.user.update({
    where: { id: user.sub },
    data: {
      ...(data.displayName !== undefined && { displayName: data.displayName }),
      ...(data.firstName !== undefined && { firstName: data.firstName }),
      ...(data.lastName !== undefined && { lastName: data.lastName }),
    },
    select: {
      id: true,
      displayName: true,
      firstName: true,
      lastName: true,
    },
  });

  return success(c, updated);
}
