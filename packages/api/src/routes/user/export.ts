import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateCode } from "@neo-id/auth-core";
import { EMAIL } from "@neo-id/shared";
import { sendEmailCode } from "../../helpers/email";
import { assertResendAllowed, invalidatePendingCodes, verifyAndUseMfaCode } from "../../helpers/mfa-code";
import { success, error } from "../../helpers/response";

export async function sendExportCode(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { email: true },
  });

  if (!dbUser) return error(c, "USER_NOT_FOUND", "User not found", 404);

  const gate = await assertResendAllowed(user.sub, "data_export");
  if (!gate.ok) {
    return error(c, "RATE_LIMITED", `Please wait ${gate.retryAfter}s`, 429, { retryAfter: gate.retryAfter });
  }

  await invalidatePendingCodes(user.sub, "data_export");

  const code = generateCode(EMAIL.CODE_LENGTH);
  await db.mfaCode.create({
    data: {
      userId: user.sub,
      code,
      purpose: "data_export",
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });

  const emailSent = await sendEmailCode(dbUser.email, code);
  if (!emailSent) return error(c, "EMAIL_FAILED", "Failed to send email", 500);

  return success(c, { sent: true, cooldown: EMAIL.RESEND_COOLDOWN });
}

export async function exportUserData(c: Context) {
  const user = c.get("user");

  const body = await c.req.json().catch(() => ({}));
  const code = String(body.code || "").trim();

  if (!code) return error(c, "CODE_REQUIRED", "Verification code is required");

  const { valid } = await verifyAndUseMfaCode(user.sub, "data_export", code);
  if (!valid) return error(c, "MFA_INVALID_CODE", "Invalid or expired code");

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
