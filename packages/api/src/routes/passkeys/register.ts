import type { Context } from "hono";
import { db } from "@neo-id/db";
import {
  generateRegistrationOpts,
  verifyRegistration,
} from "@neo-id/auth-core";
import { requireAuth } from "../../middleware/auth";
import { success, error } from "../../helpers/response";

export async function startPasskeyRegistration(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { email: true, id: true },
  });

  if (!dbUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  // Get existing passkeys
  const existingPasskeys = await db.passkey.findMany({
    where: { userId: user.sub },
    select: { credentialId: true, transports: true },
  });

  const options = await generateRegistrationOpts(
    dbUser.id,
    dbUser.email,
    existingPasskeys.map((p) => ({
      credentialId: p.credentialId,
      transports: p.transports || undefined,
    }))
  );

  // Store challenge in session (client will send it back)
  return success(c, options);
}

export async function finishPasskeyRegistration(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { response, expectedChallenge, deviceName } = body;

  if (!response || !expectedChallenge) {
    return error(c, "INVALID_REQUEST", "response and expectedChallenge are required");
  }

  const result = await verifyRegistration(response, expectedChallenge, user.sub);

  if (!result.verified || !result.credentialId || !result.credentialPublicKey) {
    return error(c, "INVALID_REQUEST", "Passkey registration failed");
  }

  // Check if credential already exists
  const existing = await db.passkey.findUnique({
    where: { credentialId: result.credentialId },
  });

  if (existing) {
    return error(c, "CONFLICT", "Passkey already registered");
  }

  // Save passkey
  const passkey = await db.passkey.create({
    data: {
      userId: user.sub,
      credentialId: result.credentialId,
      publicKey: result.credentialPublicKey,
      counter: result.counter || 0,
      transports: result.transports ? JSON.stringify(result.transports) : null,
      deviceName: deviceName || null,
    },
  });

  return success(c, {
    id: passkey.id,
    credentialId: passkey.credentialId,
    deviceName: passkey.deviceName,
    createdAt: passkey.createdAt.toISOString(),
  });
}
