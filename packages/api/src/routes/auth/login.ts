import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verify } from "@neo-id/auth-core";
import { loginSchema } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { issueTokens, getReusableSessionId } from "../../helpers/tokens";
import { setAuthCookies } from "../../helpers/auth-cookies";
import { verifyTurnstileToken } from "../../helpers/turnstile";
import { normalizeEmail } from "../../helpers/mfa-code";
import { getRequestInfo, validate } from "../../helpers/request";

export async function login(c: Context) {
  const body = await c.req.json();
  const parsed = validate(loginSchema, body);
  if (!parsed.success) return error(c, "INVALID_REQUEST", parsed.error);

  const { password } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  if (process.env.NODE_ENV === "production") {
    const turnstileToken = body.cfTurnstileToken as string | undefined;
    const validTurnstile = await verifyTurnstileToken(turnstileToken || "", c.req.header("X-Forwarded-For"));
    if (!validTurnstile) {
      return error(c, "RATE_LIMITED", "Security check failed", 429);
    }
  }
  const { deviceInfo, ipAddress } = getRequestInfo(c);

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    return error(c, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  if (!user.passwordHash) {
    return error(c, "INVALID_CREDENTIALS", "Please sign in with your connected account");
  }

  const valid = await verify(password, user.passwordHash);
  if (!valid) {
    return error(c, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  // Check MFA
  const passkeyCount = await db.passkey.count({ where: { userId: user.id } });
  const hasMfa = user.totpEnabled || user.emailMfaEnabled;

  if (hasMfa) {
    // Don't send email code here — send it only when user selects email method
    return success(c, {
      mfaRequired: true,
      mfaMethods: [
        ...(passkeyCount > 0 ? ["passkey"] : []),
        ...(user.totpEnabled ? ["totp"] : []),
        ...(user.emailMfaEnabled ? ["email"] : []),
      ],
      passkeyAvailable: passkeyCount > 0,
      emailHint: user.emailMfaEnabled ? user.email : undefined,
    });
  }

  // Reuse the browser's existing active session on re-login instead of
  // accumulating a new Session row per login.
  const tokens = await issueTokens(
    {
      userId: user.id,
      email: user.email,
      role: user.role,
      deviceInfo,
      ipAddress,
    },
    await getReusableSessionId(c, user.id),
  );

  setAuthCookies(c, tokens);

  return success(c, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    idToken: tokens.idToken,
    user: { id: user.id, email: user.email, displayName: user.displayName, role: user.role },
  });
}
