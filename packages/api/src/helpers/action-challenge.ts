import { db } from "@neo-id/db";
import { generateCode, generateAuthenticationOpts, verifyAuthentication, verifyTotp } from "@neo-id/auth-core";
import { EMAIL, type ErrorCode } from "@neo-id/shared";
import { sendEmailCode } from "./email";
import { assertResendAllowed, invalidatePendingCodes, verifyAndUseMfaCode } from "./mfa-code";

export type ActionMethod = "passkey" | "totp" | "email";

/**
 * Step-up methods available to a user, mirroring the login MFA picker:
 * passkey / TOTP when enabled, and email as the always-available fallback.
 */
export async function getAvailableMethods(userId: string): Promise<ActionMethod[]> {
  const [user, passkeyCount] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { totpEnabled: true } }),
    db.passkey.count({ where: { userId } }),
  ]);

  return [
    ...(passkeyCount > 0 ? (["passkey"] as const) : []),
    ...(user?.totpEnabled ? (["totp"] as const) : []),
    "email",
  ];
}

/** Issue + email a one-time code for a sensitive action (e.g. data_export). */
export async function sendActionCode(
  userId: string,
  purpose: string,
): Promise<{ ok: true } | { ok: false; code: ErrorCode; message: string; retryAfter?: number }> {
  const dbUser = await db.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!dbUser) return { ok: false, code: "USER_NOT_FOUND", message: "User not found" };

  const gate = await assertResendAllowed(userId, purpose);
  if (!gate.ok) {
    return { ok: false, code: "RATE_LIMITED", message: `Please wait ${gate.retryAfter}s`, retryAfter: gate.retryAfter };
  }

  await invalidatePendingCodes(userId, purpose);

  const code = generateCode(EMAIL.CODE_LENGTH);
  await db.mfaCode.create({
    data: {
      userId,
      code,
      purpose,
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });

  const emailSent = await sendEmailCode(dbUser.email, code);
  if (!emailSent) return { ok: false, code: "EMAIL_FAILED", message: "Failed to send email" };

  return { ok: true };
}

/** WebAuthn assertion options for verifying a sensitive action with a passkey. */
export async function generatePasskeyAuthOptions(userId: string) {
  const passkeys = await db.passkey.findMany({
    where: { userId },
    select: { credentialId: true, transports: true },
  });

  return generateAuthenticationOpts(
    passkeys.map((p) => ({
      credentialId: p.credentialId,
      transports: p.transports || undefined,
    })),
  );
}

/**
 * Verify a step-up attempt by method. `purpose` is the MFA-code purpose used
 * by the email method. Returns { ok: false, code, message } on failure.
 */
export async function verifyActionByMethod(
  userId: string,
  method: string,
  body: Record<string, unknown>,
  purpose: string,
): Promise<{ ok: true } | { ok: false; code: ErrorCode; message: string }> {
  if (method === "totp") {
    const dbUser = await db.user.findUnique({
      where: { id: userId },
      select: { totpEnabled: true, totpSecret: true },
    });
    if (!dbUser || !dbUser.totpEnabled || !dbUser.totpSecret) {
      return { ok: false, code: "MFA_NOT_ENABLED", message: "TOTP is not enabled" };
    }
    const code = String(body.code || "").trim();
    if (!verifyTotp(dbUser.totpSecret, code)) {
      return { ok: false, code: "MFA_INVALID_CODE", message: "Invalid or expired code" };
    }
    return { ok: true };
  }

  if (method === "passkey") {
    const response = body.response as Record<string, unknown> | undefined;
    const expectedChallenge = String(body.expectedChallenge || "");
    const credentialId = String(response?.id || "");
    if (!response || !expectedChallenge || !credentialId) {
      return { ok: false, code: "INVALID_REQUEST", message: "Passkey assertion is required" };
    }

    const passkey = await db.passkey.findFirst({
      where: { userId, credentialId },
    });
    if (!passkey) return { ok: false, code: "PASSKEY_NOT_FOUND", message: "Passkey not found" };

    const result = await verifyAuthentication(response, expectedChallenge, {
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
    });
    if (!result.verified) {
      return { ok: false, code: "INVALID_REQUEST", message: "Passkey verification failed" };
    }
    await db.passkey.update({
      where: { id: passkey.id },
      data: { counter: result.newCounter ?? passkey.counter, lastUsedAt: new Date() },
    }).catch(() => {});
    return { ok: true };
  }

  // email (default)
  const code = String(body.code || "").trim();
  if (!code) return { ok: false, code: "CODE_REQUIRED", message: "Verification code is required" };
  const { valid } = await verifyAndUseMfaCode(userId, purpose, code);
  if (!valid) return { ok: false, code: "MFA_INVALID_CODE", message: "Invalid or expired code" };
  return { ok: true };
}
