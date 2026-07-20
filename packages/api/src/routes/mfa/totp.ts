import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateTotpSecret, verifyTotp } from "@neo-id/auth-core";
import { requireAuth } from "../../middleware/auth";
import { success, error } from "../../helpers/response";

export async function setupTotp(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { totpEnabled: true, email: true },
  });

  if (!dbUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (dbUser.totpEnabled) {
    return error(c, "MFA_ALREADY_ENABLED", "TOTP is already enabled");
  }

  const setup = generateTotpSecret(dbUser.email, "Neo ID");

  // Store temporary secret (not enabled yet)
  await db.user.update({
    where: { id: user.sub },
    data: { totpSecret: setup.secret },
  });

  return success(c, {
    secret: setup.secret,
    uri: setup.uri,
    qr_code_url: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(setup.uri)}`,
  });
}

export async function enableTotp(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { code } = body;

  if (!code || code.length !== 6) {
    return error(c, "INVALID_REQUEST", "Code must be 6 digits");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!dbUser) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  if (dbUser.totpEnabled) {
    return error(c, "MFA_ALREADY_ENABLED", "TOTP is already enabled");
  }

  if (!dbUser.totpSecret) {
    return error(c, "INVALID_REQUEST", "TOTP setup not initiated. Call /mfa/totp/setup first.");
  }

  const valid = verifyTotp(dbUser.totpSecret, code);
  if (!valid) {
    return error(c, "MFA_INVALID_CODE", "Invalid TOTP code");
  }

  await db.user.update({
    where: { id: user.sub },
    data: { totpEnabled: true },
  });

  return success(c, { ok: true });
}

export async function disableTotp(c: Context) {
  const user = c.get("user");
  const body = await c.req.json();
  const { code } = body;

  if (!code || code.length !== 6) {
    return error(c, "INVALID_REQUEST", "Code must be 6 digits");
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { totpSecret: true, totpEnabled: true },
  });

  if (!dbUser?.totpEnabled) {
    return error(c, "MFA_NOT_ENABLED", "TOTP is not enabled");
  }

  if (!dbUser.totpSecret) {
    return error(c, "INTERNAL_ERROR", "TOTP secret not found");
  }

  const valid = verifyTotp(dbUser.totpSecret, code);
  if (!valid) {
    return error(c, "MFA_INVALID_CODE", "Invalid TOTP code");
  }

  await db.user.update({
    where: { id: user.sub },
    data: {
      totpEnabled: false,
      totpSecret: null,
    },
  });

  return success(c, { ok: true });
}
