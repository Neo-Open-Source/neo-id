import type { Context } from "hono";
import { db } from "@neo-id/db";
import { hash } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";
import { sendPasswordResetEmail } from "../../helpers/email";
import crypto from "node:crypto";

const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;

export async function requestPasswordReset(c: Context) {
  const body = await c.req.json();
  const email = String(body.email || "").toLowerCase().trim();

  if (!email) {
    return error(c, "INVALID_REQUEST", "Email is required");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return success(c, { sent: true });
  }

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  const existingMeta = (await db.user.findUnique({
    where: { id: user.id },
    select: { userMetadata: true },
  }))?.userMetadata as Record<string, unknown> || {};

  await db.user.update({
    where: { id: user.id },
    data: {
      userMetadata: {
        ...existingMeta,
        passwordResetToken: token,
        passwordResetExpires: expiresAt.toISOString(),
      },
    },
  });

  const webUrl = process.env.WEB_URL || "http://localhost:3001";
  const resetLink = `${webUrl}/auth/reset-password?token=${token}`;

  sendPasswordResetEmail(user.email, resetLink).catch((e) => {
    console.error("[Password Reset] Failed to send email:", e);
  });

  return success(c, { sent: true });
}

export async function resetPassword(c: Context) {
  const body = await c.req.json();
  const token = String(body.token || "").trim();
  const newPassword = body.newPassword as string | undefined;

  if (!token || !newPassword) {
    return error(c, "INVALID_REQUEST", "Token and new password are required");
  }

  if (newPassword.length < 8) {
    return error(c, "INVALID_REQUEST", "Password must be at least 8 characters");
  }

  const users = await db.user.findMany({
    where: {
      userMetadata: {
        path: ["passwordResetToken"],
        equals: token,
      },
    },
    select: { id: true, userMetadata: true },
  });

  const user = users[0];
  if (!user) {
    return error(c, "INVALID_REQUEST", "Invalid or expired reset token");
  }
  const meta = user.userMetadata as Record<string, unknown>;
  const expiresAt = new Date(meta.passwordResetExpires as string);

  if (expiresAt < new Date()) {
    return error(c, "INVALID_REQUEST", "Reset token has expired");
  }

  const passwordHash = await hash(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      userMetadata: {
        ...meta,
        passwordResetToken: null,
        passwordResetExpires: null,
      },
    },
  });

  await db.refreshToken.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date(), revokeReason: "password_reset" },
  });

  return success(c, { reset: true });
}
