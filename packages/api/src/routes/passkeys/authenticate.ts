import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateAuthenticationOpts, verifyAuthentication } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";
import { issueTokens } from "../../helpers/tokens";
import { setAuthCookies } from "../../helpers/auth-cookies";
import { getRequestInfo } from "../../helpers/request";

export async function startPasskeyAuthentication(c: Context) {
  const body = await c.req.json();
  const { email } = body;

  if (!email) {
    return error(c, "INVALID_REQUEST", "email is required");
  }

  const user = await db.user.findUnique({
    where: { email },
    select: { id: true, status: true, totpEnabled: true, emailMfaEnabled: true },
  });

  if (!user) {
    return success(c, { allow_credentials: [], mfaMethods: [] });
  }

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  const passkeys = await db.passkey.findMany({
    where: { userId: user.id },
    select: { credentialId: true, transports: true },
  });

  if (passkeys.length === 0) {
    return success(c, { allow_credentials: [], mfaMethods: [] });
  }

  const options = await generateAuthenticationOpts(
    passkeys.map((p) => ({
      credentialId: p.credentialId,
      transports: p.transports || undefined,
    }))
  );

  return success(c, {
    ...options,
    mfaMethods: ["passkey", ...(user.totpEnabled ? ["totp"] : []), ...(user.emailMfaEnabled ? ["email"] : [])],
  });
}

export async function finishPasskeyAuthentication(c: Context) {
  const body = await c.req.json();
  const { response, expectedChallenge, email } = body;

  if (!response || !expectedChallenge || !email) {
    return error(c, "INVALID_REQUEST", "response, expectedChallenge, and email are required");
  }

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
    return error(c, "INVALID_REQUEST", "Passkey verification failed");
  }

  await db.passkey.update({
    where: { id: passkey.id },
    data: {
      counter: 0,
      lastUsedAt: new Date(),
    },
  });

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
