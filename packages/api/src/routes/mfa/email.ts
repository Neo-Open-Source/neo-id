import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateCode } from "@neo-id/auth-core";
import { EMAIL } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function setupEmailMfa(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { emailMfaEnabled: true, email: true },
  });

  if (!dbUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (dbUser.emailMfaEnabled) {
    return error(c, "MFA_ALREADY_ENABLED", "Email MFA is already enabled");
  }

  // Generate and send code
  const code = generateCode(EMAIL.CODE_LENGTH);
  await db.mfaCode.create({
    data: {
      userId: user.sub,
      code,
      purpose: "mfa_setup",
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });

  // TODO: Send email via Resend

  return success(c, {
    email_hint: dbUser.email.replace(/(.{2}).*(@.*)/, "$1***$2"),
  });
}

export async function enableEmailMfa(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { code } = body;

  if (!code || code.length !== EMAIL.CODE_LENGTH) {
    return error(c, "INVALID_REQUEST", `Code must be ${EMAIL.CODE_LENGTH} digits`);
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { emailMfaEnabled: true },
  });

  if (!dbUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (dbUser.emailMfaEnabled) {
    return error(c, "MFA_ALREADY_ENABLED", "Email MFA is already enabled");
  }

  // Verify code
  const mfaCode = await db.mfaCode.findFirst({
    where: {
      userId: user.sub,
      purpose: "mfa_setup",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!mfaCode || mfaCode.code !== code) {
    return error(c, "MFA_INVALID_CODE", "Invalid or expired code");
  }

  // Mark code as used
  await db.mfaCode.update({
    where: { id: mfaCode.id },
    data: { usedAt: new Date() },
  });

  // Enable email MFA
  await db.user.update({
    where: { id: user.sub },
    data: { emailMfaEnabled: true },
  });

  return success(c, { ok: true });
}

export async function disableEmailMfa(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { code } = body;

  if (!code || code.length !== EMAIL.CODE_LENGTH) {
    return error(c, "INVALID_REQUEST", `Code must be ${EMAIL.CODE_LENGTH} digits`);
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { emailMfaEnabled: true },
  });

  if (!dbUser?.emailMfaEnabled) {
    return error(c, "MFA_NOT_ENABLED", "Email MFA is not enabled");
  }

  // Verify code
  const mfaCode = await db.mfaCode.findFirst({
    where: {
      userId: user.sub,
      purpose: "mfa_disable",
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!mfaCode || mfaCode.code !== code) {
    // Generate new code for disable
    const newCode = generateCode(EMAIL.CODE_LENGTH);
    await db.mfaCode.create({
      data: {
        userId: user.sub,
        code: newCode,
        purpose: "mfa_disable",
        expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
      },
    });
    // TODO: Send email
    return error(c, "MFA_INVALID_CODE", "Invalid code. A new code has been sent to your email.");
  }

  // Mark code as used
  await db.mfaCode.update({
    where: { id: mfaCode.id },
    data: { usedAt: new Date() },
  });

  // Disable email MFA
  await db.user.update({
    where: { id: user.sub },
    data: { emailMfaEnabled: false },
  });

  return success(c, { ok: true });
}
