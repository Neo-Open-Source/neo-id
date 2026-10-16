import type { PrismaClient } from "@neo-id/db";
import { generateCode, generateAuthenticationOpts, verifyAuthentication, verifyTotp } from "@neo-id/auth-core";
import { EMAIL, type ErrorCode } from "@neo-id/shared";
import { sendEmailCode } from "./email";
import { assertResendAllowed, invalidatePendingCodes, verifyAndUseMfaCode } from "./mfa-code";

export type ActionMethod = "passkey" | "totp" | "email";

export async function getAvailableMethods(client: PrismaClient, userId: string): Promise<ActionMethod[]> {
  const [user, passkeyCount] = await Promise.all([
    client.user.findUnique({ where: { id: userId }, select: { totpEnabled: true } }),
    client.passkey.count({ where: { userId } }),
  ]);

  return [
    ...(passkeyCount > 0 ? (["passkey"] as const) : []),
    ...(user?.totpEnabled ? (["totp"] as const) : []),
    "email",
  ];
}

export async function sendActionCode(
  client: PrismaClient,
  userId: string,
  purpose: string,
): Promise<{ ok: true } | { ok: false; code: ErrorCode; message: string; retryAfter?: number }> {
  const dbUser = await client.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });

  if (!dbUser) return { ok: false, code: "USER_NOT_FOUND", message: "User not found" };

  const gate = await assertResendAllowed(client, userId, purpose);
  if (!gate.ok) {
    return { ok: false, code: "RATE_LIMITED", message: `Please wait ${gate.retryAfter}s`, retryAfter: gate.retryAfter };
  }

  await invalidatePendingCodes(client, userId, purpose);

  const code = generateCode(EMAIL.CODE_LENGTH);
  await client.mfaCode.create({
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

export async function generatePasskeyAuthOptions(client: PrismaClient, userId: string) {
  const passkeys = await client.passkey.findMany({
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

export async function verifyActionByMethod(
  client: PrismaClient,
  userId: string,
  method: string,
  body: Record<string, unknown>,
  purpose: string,
): Promise<{ ok: true } | { ok: false; code: ErrorCode; message: string }> {
  if (method === "totp") {
    const dbUser = await client.user.findUnique({
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

    const passkey = await client.passkey.findFirst({
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
    await client.passkey.update({
      where: { id: passkey.id },
      data: { counter: result.newCounter ?? passkey.counter, lastUsedAt: new Date() },
    }).catch(() => {});
    return { ok: true };
  }

  const code = String(body.code || "").trim();
  if (!code) return { ok: false, code: "CODE_REQUIRED", message: "Verification code is required" };
  const { valid } = await verifyAndUseMfaCode(client, userId, purpose, code);
  if (!valid) return { ok: false, code: "MFA_INVALID_CODE", message: "Invalid or expired code" };
  return { ok: true };
}
