import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verifyTotp } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";
import { issueTokens } from "../../helpers/tokens";
import { setAuthCookies } from "../../helpers/auth-cookies";
import { getRequestInfo } from "../../helpers/request";
import { normalizeEmail, verifyAndUseMfaCode } from "../../helpers/mfa-code";

export async function verifyMfa(c: Context) {
  const body = await c.req.json();
  const email = normalizeEmail(String(body.email || ""));
  const method = body.method as string | undefined;
  const code = String(body.code || "").trim();
  const purpose = body.purpose as string | undefined;

  if (!email || !method || !code) {
    return error(c, "INVALID_REQUEST", "email, method, and code are required");
  }

  // Find user
  const user = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      totpEnabled: true,
      totpSecret: true,
      emailMfaEnabled: true,
      emailVerified: true,
    },
  });

  if (!user) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  // ─── Email verification (registration) ──────────────────────────────────
  if (purpose === "verify_email") {
    if (user.emailVerified) return success(c, { verified: true });

    const { valid } = await verifyAndUseMfaCode(user.id, "verify_email", code);
    if (!valid) return error(c, "MFA_INVALID_CODE", "Invalid or expired code");

    await db.user.update({ where: { id: user.id }, data: { emailVerified: true } });

    const { deviceInfo, ipAddress } = getRequestInfo(c);
    const tokens = await issueTokens({ userId: user.id, email: user.email, role: user.role, deviceInfo, ipAddress });

    setAuthCookies(c, tokens);

    return success(c, {
      verified: true,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      idToken: tokens.idToken,
    });
  }

  // ─── MFA during login (totp / email) ────────────────────────────────────

  if (method === "totp") {
    if (!user.totpEnabled || !user.totpSecret) {
      return error(c, "MFA_NOT_ENABLED", "TOTP is not enabled");
    }

    const valid = verifyTotp(user.totpSecret, code);
    if (!valid) {
      return error(c, "MFA_INVALID_CODE", "Invalid TOTP code");
    }
  } else if (method === "email") {
    if (!user.emailMfaEnabled) return error(c, "MFA_NOT_ENABLED", "Email MFA is not enabled");

    const { valid } = await verifyAndUseMfaCode(user.id, "mfa_login", code);
    if (!valid) return error(c, "MFA_INVALID_CODE", "Invalid or expired code");
  } else {
    return error(c, "INVALID_REQUEST", "Invalid MFA method. Use 'totp' or 'email'.");
  }

  // MFA verified — issue tokens
  const { deviceInfo, ipAddress } = getRequestInfo(c);
  const tokens = await issueTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
    deviceInfo,
    ipAddress,
  });

  setAuthCookies(c, tokens);

  return success(c, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    user: { id: user.id, email: user.email, role: user.role },
  });
}
