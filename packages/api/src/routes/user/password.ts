import type { Context } from "hono";
import { db } from "@neo-id/db";
import { hash, verify, verifyTotp } from "@neo-id/auth-core";
import { changePasswordSchema } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { validate } from "../../helpers/request";
import { issueTokens, getReusableSessionId } from "../../helpers/tokens";
import { setAuthCookies } from "../../helpers/auth-cookies";
import { getRequestInfo } from "../../helpers/request";
import {
  createAndSendMfaCode,
  verifyAndUseMfaCode,
  maskEmail,
} from "../../helpers/mfa-code";
import { sendEmailCode } from "../../helpers/email";
import {
  generateAuthenticationOpts,
  verifyAuthentication,
} from "@neo-id/auth-core";

export async function changePassword(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = validate(changePasswordSchema, body);
  if (!parsed.success) return error(c, "INVALID_REQUEST", parsed.error);

  const { currentPassword, newPassword } = parsed.data;

  const currentUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { passwordHash: true },
  });

  if (!currentUser?.passwordHash) {
    return error(c, "INVALID_REQUEST", "No password set. Use a connected account.");
  }

  const valid = await verify(currentPassword, currentUser.passwordHash);
  if (!valid) {
    return error(c, "INVALID_CREDENTIALS", "Current password is incorrect");
  }

  const newHash = await hash(newPassword);

  await db.user.update({
    where: { id: user.sub },
    data: { passwordHash: newHash },
  });

  await db.refreshToken.updateMany({
    where: {
      userId: user.sub,
      revokedAt: null,
    },
    data: { revokedAt: new Date(), revokeReason: "password_changed" },
  });

  return success(c, { ok: true });
}

export async function requestProfilePasswordReset(c: Context) {
  const authUser = c.get("user");

  const user = await db.user.findUnique({
    where: { id: authUser.sub },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      totpEnabled: true,
      emailMfaEnabled: true,
    },
  });

  if (!user?.passwordHash) {
    return error(c, "INVALID_REQUEST", "No password set. Use a connected account.");
  }

  const mfaMethods: string[] = [];
  if (user.totpEnabled) mfaMethods.push("totp");
  if (user.emailMfaEnabled) mfaMethods.push("email");

  const passkeys = await db.passkey.findMany({
    where: { userId: user.id },
    select: { id: true },
  });
  if (passkeys.length > 0) mfaMethods.push("passkey");

  if (mfaMethods.length === 0) {
    return error(c, "INVALID_REQUEST", "No 2FA methods enabled. Use current password to change it.");
  }

  if (user.emailMfaEnabled) {
    await createAndSendMfaCode(
      user.id,
      "profile_password_reset",
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

export async function verifyProfilePasswordReset(c: Context) {
  const authUser = c.get("user");
  const body = await c.req.json();
  const method = body.method as string;
  const code = String(body.code || "").trim();
  const response = body.response;
  const expectedChallenge = body.expectedChallenge as string;
  const newPassword = body.newPassword as string | undefined;

  if (!method || !newPassword) {
    return error(c, "INVALID_REQUEST", "method and newPassword are required");
  }

  if (newPassword.length < 8) {
    return error(c, "INVALID_REQUEST", "Password must be at least 8 characters");
  }

  const user = await db.user.findUnique({
    where: { id: authUser.sub },
    select: {
      id: true,
      email: true,
      passwordHash: true,
      totpEnabled: true,
      totpSecret: true,
      emailMfaEnabled: true,
    },
  });

  if (!user?.passwordHash) {
    return error(c, "INVALID_REQUEST", "No password set. Use a connected account.");
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
    const { valid } = await verifyAndUseMfaCode(user.id, "profile_password_reset", code);
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

  const newHash = await hash(newPassword);

  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  await db.refreshToken.updateMany({
    where: { userId: user.id },
    data: { revokedAt: new Date(), revokeReason: "password_reset" },
  });

  const { deviceInfo, ipAddress } = getRequestInfo(c);
  const tokens = await issueTokens(
    {
      userId: user.id,
      email: user.email,
      role: authUser.role,
      deviceInfo,
      ipAddress,
    },
    await getReusableSessionId(c, user.id),
  );

  setAuthCookies(c, tokens);

  return success(c, {
    ok: true,
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
  });
}

export async function startProfilePasskeyResetChallenge(c: Context) {
  const authUser = c.get("user");

  const user = await db.user.findUnique({
    where: { id: authUser.sub },
    select: { id: true, passwordHash: true },
  });

  if (!user?.passwordHash) {
    return error(c, "INVALID_REQUEST", "No password set. Use a connected account.");
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
