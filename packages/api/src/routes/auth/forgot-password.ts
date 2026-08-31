import type { Context } from "hono";
import { db } from "@neo-id/db";
import { hash, verifyTotp } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";
import { sendPasswordResetEmail, sendEmailCode } from "../../helpers/email";
import { generateAuthenticationOpts, verifyAuthentication } from "@neo-id/auth-core";
import {
  createAndSendMfaCode,
  verifyAndUseMfaCode,
  maskEmail,
} from "../../helpers/mfa-code";
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
    select: {
      id: true,
      email: true,
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      emailMfaEnabled: true,
    },
  });

  if (!user || !user.passwordHash) {
    return success(c, { sent: true });
  }

  const hasMfa = user.totpEnabled || user.emailMfaEnabled;

  if (!hasMfa) {
    return sendResetLink(c, user.id, user.email);
  }

  const mfaMethods: string[] = [];
  if (user.totpEnabled) mfaMethods.push("totp");
  if (user.emailMfaEnabled) mfaMethods.push("email");

  const passkeys = await db.passkey.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  if (passkeys.length > 0) mfaMethods.push("passkey");

  if (user.emailMfaEnabled) {
    await createAndSendMfaCode(
      user.id,
      "forgot_password",
      sendEmailCode,
      user.email,
    );
  }

  return success(c, {
    mfaRequired: true,
    mfaMethods,
    emailHint: user.emailMfaEnabled ? maskEmail(user.email) : undefined,
  });
}

async function sendResetLink(c: Context, userId: string, email: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS);

  const existingMeta = (await db.user.findUnique({
    where: { id: userId },
    select: { userMetadata: true },
  }))?.userMetadata as Record<string, unknown> || {};

  await db.user.update({
    where: { id: userId },
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

  sendPasswordResetEmail(email, resetLink).catch((e) => {
    console.error("[Password Reset] Failed to send email:", e);
  });

  return success(c, { sent: true });
}

export async function verifyForgotPasswordMfa(c: Context) {
  const body = await c.req.json();
  const email = String(body.email || "").toLowerCase().trim();
  const method = body.method as string;
  const code = String(body.code || "").trim();
  const response = body.response;
  const expectedChallenge = body.expectedChallenge as string;

  if (!email || !method) {
    return error(c, "INVALID_REQUEST", "email and method are required");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      emailMfaEnabled: true,
    },
  });

  if (!user || !user.passwordHash) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (method === "totp") {
    if (!user.totpEnabled || !user.totpSecret) {
      return error(c, "MFA_NOT_ENABLED", "TOTP is not enabled");
    }
    if (!code) {
      return error(c, "INVALID_REQUEST", "code is required for TOTP");
    }
    const valid = verifyTotp(user.totpSecret, code);
    if (!valid) {
      return error(c, "MFA_INVALID_CODE", "Invalid TOTP code");
    }
  } else if (method === "email") {
    if (!user.emailMfaEnabled) {
      return error(c, "MFA_NOT_ENABLED", "Email MFA is not enabled");
    }
    if (!code) {
      return error(c, "INVALID_REQUEST", "code is required for email MFA");
    }
    const { valid } = await verifyAndUseMfaCode(user.id, "forgot_password", code);
    if (!valid) {
      return error(c, "MFA_INVALID_CODE", "Invalid or expired code");
    }
  } else if (method === "passkey") {
    if (!response || !expectedChallenge) {
      return error(c, "INVALID_REQUEST", "response and expectedChallenge are required for passkey");
    }
    const passkey = await db.passkey.findFirst({
      where: { userId: user.id, credentialId: response.id },
    });
    if (!passkey) {
      return error(c, "PASSKEY_NOT_FOUND", "Passkey not found");
    }
    const result = await verifyAuthentication(response, expectedChallenge, {
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
    });
    if (!result.verified) {
      return error(c, "MFA_INVALID_CODE", "Passkey verification failed");
    }
    await db.passkey.update({
      where: { id: passkey.id },
      data: { counter: result.newCounter ?? passkey.counter, lastUsedAt: new Date() },
    });
  } else {
    return error(c, "INVALID_REQUEST", "Invalid method. Use 'totp', 'email', or 'passkey'.");
  }

  return sendResetLink(c, user.id, user.email);
}

export async function startPasskeyResetChallenge(c: Context) {
  const body = await c.req.json();
  const email = String(body.email || "").toLowerCase().trim();

  if (!email) {
    return error(c, "INVALID_REQUEST", "email is required");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return success(c, { allow_credentials: [] });
  }

  const passkeys = await db.passkey.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  if (passkeys.length === 0) {
    return success(c, { allow_credentials: [] });
  }

  const options = await generateAuthenticationOpts(
    passkeys.map((p) => ({
      credentialId: p.credentialId,
      transports: p.transports || undefined,
    })),
  );

  return success(c, options);
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
