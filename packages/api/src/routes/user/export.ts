import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";
import {
  getAvailableMethods,
  sendActionCode,
  generatePasskeyAuthOptions,
  verifyActionByMethod,
} from "../../helpers/action-challenge";

const EXPORT_PURPOSE = "data_export";

/**
 * Step-up challenge for data export — mirrors the login MFA picker so the user
 * can verify with a passkey, TOTP code, or an email code instead of being
 * forced through an email code every time.
 */
export async function exportChallenge(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { email: true },
  });

  if (!dbUser) return error(c, "USER_NOT_FOUND", "User not found", 404);

  const methods = await getAvailableMethods(user.sub);
  return success(c, { mfaRequired: true, methods, emailHint: dbUser.email });
}

/** WebAuthn assertion options for verifying a data export with a passkey. */
export async function startExportPasskey(c: Context) {
  const user = c.get("user");

  const options = await generatePasskeyAuthOptions(user.sub);
  if (!options.allowCredentials?.length) {
    return error(c, "PASSKEY_NOT_FOUND", "No passkeys registered", 404);
  }

  return success(c, options);
}

export async function sendExportCode(c: Context) {
  const user = c.get("user");

  const result = await sendActionCode(user.sub, EXPORT_PURPOSE);
  if (!result.ok) {
    return error(c, result.code, result.message, result.code === "RATE_LIMITED" ? 429 : undefined, {
      ...(result.retryAfter !== undefined ? { retryAfter: result.retryAfter } : {}),
    });
  }

  return success(c, { sent: true, cooldown: 60 });
}

export async function exportUserData(c: Context) {
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));
  const method = String(body.method || "email");

  const verified = await verifyActionByMethod(user.sub, method, body, EXPORT_PURPOSE);
  if (!verified.ok) {
    return error(c, verified.code, verified.message);
  }

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
      role: true,
      totpEnabled: true,
      emailMfaEnabled: true,
      createdAt: true,
      updatedAt: true,
      lastLoginAt: true,
      lastLoginIp: true,
    },
  });

  const [sessions, passkeys, identities, services] = await Promise.all([
    db.session.findMany({
      where: { userId: user.sub, isActive: true },
      select: { id: true, deviceInfo: true, ipAddress: true, createdAt: true, lastActiveAt: true },
      orderBy: { createdAt: "desc" },
    }),
    db.passkey.findMany({
      where: { userId: user.sub },
      select: { id: true, deviceName: true, createdAt: true, lastUsedAt: true },
    }),
    db.identity.findMany({
      where: { userId: user.sub },
      select: { provider: true, createdAt: true },
    }),
    db.serviceApp.findMany({
      where: { ownerId: user.sub },
      select: { id: true, name: true, displayName: true, clientId: true, createdAt: true },
    }),
  ]);

  return success(c, {
    exportedAt: new Date().toISOString(),
    profile: profile ?? undefined,
    sessions,
    passkeys,
    identities,
    services,
  });
}
