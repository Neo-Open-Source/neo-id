import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verifyTotp } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";

export async function verifyMfa(c: Context) {
  const body = await c.req.json();
  const { user_id, method, code } = body;

  if (!user_id || !method || !code) {
    return error(c, "INVALID_REQUEST", "user_id, method, and code are required");
  }

  // Find user
  const user = await db.user.findUnique({
    where: { id: user_id },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      totpEnabled: true,
      totpSecret: true,
      emailMfaEnabled: true,
    },
  });

  if (!user) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  if (method === "totp") {
    if (!user.totpEnabled || !user.totpSecret) {
      return error(c, "MFA_NOT_ENABLED", "TOTP is not enabled");
    }

    const valid = verifyTotp(user.totpSecret, code);
    if (!valid) {
      return error(c, "MFA_INVALID_CODE", "Invalid TOTP code");
    }
  } else if (method === "email") {
    if (!user.emailMfaEnabled) {
      return error(c, "MFA_NOT_ENABLED", "Email MFA is not enabled");
    }

    // Find and verify code
    const mfaCode = await db.mfaCode.findFirst({
      where: {
        userId: user.id,
        purpose: "mfa_login",
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
  } else {
    return error(c, "INVALID_REQUEST", "Invalid MFA method. Use 'totp' or 'email'.");
  }

  // MFA verified — the calling route should handle token generation
  // Return success so the login flow can continue
  return success(c, {
    mfa_verified: true,
    user_id: user.id,
    email: user.email,
    role: user.role,
  });
}
