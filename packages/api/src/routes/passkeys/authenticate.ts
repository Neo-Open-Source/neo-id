import type { Context } from "hono";
import { db } from "@neo-id/db";
import {
  generateAuthenticationOpts,
  verifyAuthentication,
  signAccessToken,
  signIdToken,
  generateToken,
  hashToken,
} from "@neo-id/auth-core";
import { TOKEN } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function startPasskeyAuthentication(c: Context) {
  const body = await c.req.json();
  const { email } = body;

  if (!email) {
    return error(c, "INVALID_REQUEST", "email is required");
  }

  // Find user by email
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true },
  });

  if (!user) {
    // Return generic error to prevent email enumeration
    return success(c, { allow_credentials: [] });
  }

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  // Get user's passkeys
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
    }))
  );

  return success(c, options);
}

export async function finishPasskeyAuthentication(c: Context) {
  const body = await c.req.json();
  const { response, expectedChallenge, email } = body;

  if (!response || !expectedChallenge || !email) {
    return error(c, "INVALID_REQUEST", "response, expectedChallenge, and email are required");
  }

  // Find user
  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  // Find the passkey by credential ID
  const passkey = await db.passkey.findFirst({
    where: {
      userId: user.id,
      credentialId: response.id,
    },
  });

  if (!passkey) {
    return error(c, "PASSKEY_NOT_FOUND", "Passkey not found");
  }

  // Verify authentication
  const result = await verifyAuthentication(
    response,
    expectedChallenge,
    {
      credentialId: passkey.credentialId,
      publicKey: passkey.publicKey,
      counter: passkey.counter,
    }
  );

  if (!result.verified) {
    return error(c, "INVALID_REQUEST", "Passkey verification failed");
  }

  // Update counter and last used
  await db.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: result.newCounter || passkey.counter + 1,
      lastUsedAt: new Date(),
    },
  });

  // Create session (passkey = MFA satisfied automatically)
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
      role: user.role,
    },
  });
}
