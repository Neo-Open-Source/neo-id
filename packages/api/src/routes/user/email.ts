import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateCode } from "@neo-id/auth-core";
import { changeEmailSchema, EMAIL } from "@neo-id/shared";
import { sendEmailCode } from "../../helpers/email";
import { error, success } from "../../helpers/response";
import { validate } from "../../helpers/request";
import { normalizeEmail, maskEmail, verifyAndUseMfaCode } from "../../helpers/mfa-code";

const EMAIL_CHANGE_PURPOSE = "email_change";

export async function requestEmailChange(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = validate(changeEmailSchema, body);
  if (!parsed.success) return error(c, "INVALID_REQUEST", parsed.error);

  const newEmail = normalizeEmail(parsed.data.newEmail);
  const current = await db.user.findUnique({ where: { id: user.sub }, select: { email: true } });
  if (!current) return error(c, "USER_NOT_FOUND", "User not found", 404);
  if (current.email === newEmail) return error(c, "INVALID_REQUEST", "New email must be different");

  const taken = await db.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (taken) return error(c, "EMAIL_ALREADY_EXISTS", "Email is already registered", 409);

  const code = generateCode(EMAIL.CODE_LENGTH);
  const delivered = await sendEmailCode(current.email, code);
  if (!delivered) return error(c, "INTERNAL_ERROR", "Unable to send verification code", 500);

  await db.mfaCode.create({
    data: {
      userId: user.sub,
      code,
      purpose: EMAIL_CHANGE_PURPOSE,
      targetEmail: newEmail,
      usedAt: null,
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });
  return success(c, { emailHint: maskEmail(current.email) });
}

export async function confirmEmailChange(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = validate(changeEmailSchema, body);
  const code = typeof body.code === "string" ? body.code.trim() : "";
  if (!parsed.success || code.length !== EMAIL.CODE_LENGTH) return error(c, "INVALID_REQUEST", "Invalid request");

  const newEmail = normalizeEmail(parsed.data.newEmail);

  const { valid } = await verifyAndUseMfaCode(user.sub, EMAIL_CHANGE_PURPOSE, code, { targetEmail: newEmail });
  if (!valid) return error(c, "MFA_INVALID_CODE", "Invalid or expired code");

  await db.user.update({ where: { id: user.sub }, data: { email: newEmail, emailVerified: true } });
  return success(c, { email: newEmail });
}
