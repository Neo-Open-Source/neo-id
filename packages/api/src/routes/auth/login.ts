import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verify, signAccessToken, signIdToken, generateToken, hashToken } from "@neo-id/auth-core";
import { loginSchema, TOKEN, type LoginInput } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function login(c: Context) {
  const body = await c.req.json();
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, "INVALID_REQUEST", parsed.error.errors[0]?.message || "Invalid input");
  }

  const { email, password } = parsed.data as LoginInput;

  // Find user
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

  // Verify password
  const valid = await verify(password, user.passwordHash);
  if (!valid) {
    return error(c, "INVALID_CREDENTIALS", "Email or password is incorrect");
  }

  // Check if MFA is enabled
  if (user.totpEnabled || user.emailMfaEnabled) {
    // Create MFA code for email (if email MFA enabled)
    if (user.emailMfaEnabled) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      await db.mfaCode.create({
        data: {
          userId: user.id,
          code,
          purpose: "mfa_login",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      // TODO: Send MFA code via email
    }

    return success(c, {
      mfaRequired: true,
      mfaMethods: [
        ...(user.totpEnabled ? ["totp"] : []),
        ...(user.emailMfaEnabled ? ["email"] : []),
      ],
    });
  }

  // Create session
  const session = await db.session.create({
    data: {
      userId: user.id,
      deviceInfo: c.req.header("User-Agent"),
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
    },
  });

  // Generate tokens
  const accessToken = await signAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    session.id
  );
  const idToken = await signIdToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  // Create refresh token
  const refreshToken = generateToken(TOKEN.REFRESH_TOKEN_LENGTH);
  await db.refreshToken.create({
    data: {
      userId: user.id,
      sessionId: session.id,
      tokenHash: hashToken(refreshToken),
      deviceInfo: c.req.header("User-Agent"),
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
    },
  });

  // Update last login
  await db.user.update({
    where: { id: user.id },
    data: {
      lastLoginAt: new Date(),
      lastLoginIp: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
    },
  });

  return success(c, {
    accessToken,
    refreshToken,
    idToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
    },
  });
}
