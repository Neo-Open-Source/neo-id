import type { PrismaClient } from "@neo-id/db";
import { generateCode, constantTimeEqual } from "@neo-id/auth-core";
import { EMAIL } from "@neo-id/shared";

export function unusedMfaCodeWhere() {
  return { usedAt: null };
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function maskEmail(email: string): string {
  return email.replace(/(.{2}).*(@.*)/, "$1***$2");
}

export async function assertResendAllowed(client: PrismaClient, userId: string, purpose: string) {
  const latest = await client.mfaCode.findFirst({
    where: { userId, purpose },
    orderBy: { createdAt: "desc" },
    select: { createdAt: true },
  });

  if (!latest) return { ok: true as const };

  const elapsed = (Date.now() - latest.createdAt.getTime()) / 1000;
  const remaining = Math.ceil(EMAIL.RESEND_COOLDOWN - elapsed);
  if (remaining > 0) {
    return { ok: false as const, retryAfter: remaining };
  }
  return { ok: true as const };
}

export async function verifyAndUseMfaCode(
  client: PrismaClient,
  userId: string,
  purpose: string,
  code: string,
  extraWhere?: Record<string, unknown>,
) {
  if (!code || code.length !== EMAIL.CODE_LENGTH) {
    return { valid: false as const };
  }

  const mfaCode = await client.mfaCode.findFirst({
    where: {
      userId,
      purpose,
      expiresAt: { gte: new Date() },
      ...unusedMfaCodeWhere(),
      ...extraWhere,
    },
    orderBy: { createdAt: "desc" },
  });

  if (!mfaCode || !constantTimeEqual(mfaCode.code, code)) {
    return { valid: false as const };
  }

  await client.mfaCode.update({
    where: { id: mfaCode.id },
    data: { usedAt: new Date() },
  });

  return { valid: true as const, mfaCode };
}

export async function invalidatePendingCodes(client: PrismaClient, userId: string, purpose: string) {
  await client.$executeRawUnsafe(
    `UPDATE "mfa_codes" SET "usedAt" = $3 WHERE "userId" = $1 AND "purpose" = $2 AND "usedAt" IS NULL`,
    userId,
    purpose,
    new Date(),
  );
}

export async function createAndSendMfaCode(
  client: PrismaClient,
  userId: string,
  purpose: string,
  sendFn: (email: string, code: string) => Promise<boolean>,
  email: string,
) {
  await invalidatePendingCodes(client, userId, purpose);
  const code = generateCode(EMAIL.CODE_LENGTH);
  await client.mfaCode.create({
    data: {
      userId,
      code,
      purpose,
      usedAt: null,
      expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
    },
  });
  return sendFn(email, code);
}
