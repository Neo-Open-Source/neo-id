import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateCode } from "@neo-id/auth-core";
import { EMAIL } from "@neo-id/shared";
import { sendLoginCodeEmail, sendEmailCode, sendEmailVerificationEmail } from "../../helpers/email";
import { success, error } from "../../helpers/response";
import {
  normalizeEmail,
  maskEmail,
  unusedMfaCodeWhere,
  assertResendAllowed,
  verifyAndUseMfaCode,
  invalidatePendingCodes,
} from "../../helpers/mfa-code";

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

  const gate = await assertResendAllowed(user.sub, "mfa_setup");
  if (!gate.ok) {
    return error(
      c,
      "RATE_LIMITED",
      `Please wait ${gate.retryAfter}s before requesting another code`,
      429,
      { retryAfter: gate.retryAfter },
    );
  }

  const code = generateCode(EMAIL.CODE_LENGTH);
  await db.mfaCode.create({
    data: {
      userId: user.sub,
      code,
      purpose: "mfa_setup",
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });

  await sendEmailCode(dbUser.email, code);

  return success(c, {
    email_hint: maskEmail(dbUser.email),
    cooldown: EMAIL.RESEND_COOLDOWN,
  });
}

export async function enableEmailMfa(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const code = String(body.code || "").trim();

  const existing = await db.user.findUnique({
    where: { id: user.sub },
    select: { emailMfaEnabled: true },
  });

  if (!existing) return error(c, "USER_NOT_FOUND", "User not found", 404);
  if (existing.emailMfaEnabled) return error(c, "MFA_ALREADY_ENABLED", "Email MFA is already enabled");

  const { valid } = await verifyAndUseMfaCode(user.sub, "mfa_setup", code);
  if (!valid) return error(c, "MFA_INVALID_CODE", "Invalid or expired code");

  await db.user.update({
    where: { id: user.sub },
    data: { emailMfaEnabled: true },
  });

  return success(c, { ok: true });
}

export async function disableEmailMfa(c: Context) {
  const user = c.get("user");

  const existing = await db.user.findUnique({
    where: { id: user.sub },
    select: { emailMfaEnabled: true },
  });

  if (!existing?.emailMfaEnabled) return error(c, "MFA_NOT_ENABLED", "Email MFA is not enabled");

  await db.user.update({
    where: { id: user.sub },
    data: { emailMfaEnabled: false },
  });

  return success(c, { ok: true });
}

/** Resend login MFA email code (unauthenticated — used during sign-in). */
export async function resendLoginEmailMfa(c: Context) {
  const body = await c.req.json().catch(() => ({}));
  const email = normalizeEmail(String(body.email || ""));
  const purpose = String(body.purpose || "mfa_login").trim();

  if (!email) {
    return error(c, "INVALID_REQUEST", "Email is required");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, emailMfaEnabled: true, email: true, emailVerified: true },
  });

  if (!user) {
    return success(c, { sent: true, cooldown: EMAIL.RESEND_COOLDOWN });
  }

  if (purpose !== "verify_email" && !user.emailMfaEnabled) {
    return success(c, { sent: true, cooldown: EMAIL.RESEND_COOLDOWN });
  }

  const codePurpose = purpose === "verify_email" ? "verify_email" : "mfa_login";
  const gate = await assertResendAllowed(user.id, codePurpose);
  if (!gate.ok) {
    return error(
      c,
      "RATE_LIMITED",
      `Please wait ${gate.retryAfter}s before requesting another code`,
      429,
      { retryAfter: gate.retryAfter },
    );
  }

  await invalidatePendingCodes(user.id, codePurpose);

  const code = generateCode(EMAIL.CODE_LENGTH);
  await db.mfaCode.create({
    data: {
      userId: user.id,
      code,
      purpose: codePurpose,
      usedAt: null,
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });

  let sent: boolean;
  if (purpose === "verify_email") {
    const linkRecord = await db.mfaCode.findFirst({
      where: {
        userId: user.id,
        purpose: "verify_email_link",
        expiresAt: { gte: new Date() },
        ...unusedMfaCodeWhere(),
      },
      orderBy: { createdAt: "desc" },
      select: { code: true },
    });
    const webUrl = process.env.WEB_URL || "http://localhost:3001";
    const verifyLink = linkRecord ? `${webUrl}/auth/verify-email?token=${linkRecord.code}` : "";
    sent = await sendEmailVerificationEmail(user.email, code, verifyLink);
  } else {
    sent = await sendLoginCodeEmail(user.email, code);
  }

  if (!sent) {
    return error(c, "EMAIL_FAILED", "Failed to send email. Please try again.", 500);
  }

  return success(c, { sent: true, cooldown: EMAIL.RESEND_COOLDOWN });
}
