import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";
import { normalizeEmail, verifyAndUseMfaCode, unusedMfaCodeWhere } from "../../helpers/mfa-code";

export async function verifyEmail(c: Context) {
  const body = await c.req.json();
  const email = normalizeEmail(String(body.email || ""));
  const code = String(body.code || "").trim();

  if (!email || !code) {
    return error(c, "INVALID_REQUEST", "email and code are required");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, emailVerified: true },
  });

  if (!user) return error(c, "USER_NOT_FOUND", "User not found", 404);
  if (user.emailVerified) return success(c, { verified: true });

  const { valid } = await verifyAndUseMfaCode(user.id, "verify_email", code);
  if (!valid) return error(c, "MFA_INVALID_CODE", "Invalid or expired code");

  await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

  return success(c, { verified: true });
}

export async function verifyEmailByToken(c: Context) {
  const body = await c.req.json();
  const token = String(body.token || "").trim();

  if (!token) {
    return error(c, "INVALID_REQUEST", "token is required");
  }

  const record = await db.mfaCode.findFirst({
    where: {
      code: token,
      purpose: "verify_email_link",
      expiresAt: { gte: new Date() },
      ...unusedMfaCodeWhere(),
    },
    include: { user: true },
  });

  if (!record) {
    return error(c, "MFA_INVALID_CODE", "Invalid or expired verification link");
  }

  if (record.user.emailVerified) {
    await db.mfaCode.update({ where: { id: record.id }, data: { usedAt: new Date() } });
    return success(c, { verified: true });
  }

  await db.$transaction([
    db.mfaCode.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: record.user.id }, data: { emailVerified: true } }),
  ]);

  return success(c, { verified: true });
}
