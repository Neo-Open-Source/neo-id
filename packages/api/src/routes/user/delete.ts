import type { Context } from "hono";
import { db } from "@neo-id/db";
import { verify } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";
import {
  getAvailableMethods,
  sendActionCode,
  generatePasskeyAuthOptions,
  verifyActionByMethod,
} from "../../helpers/action-challenge";

const DELETE_PURPOSE = "account_delete";

/**
 * Step-up challenge for account deletion — same method picker as login / export:
 * passkey, TOTP, or email code.
 */
export async function deleteChallenge(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { email: true },
  });

  if (!dbUser) return error(c, "USER_NOT_FOUND", "User not found", 404);

  const methods = await getAvailableMethods(user.sub);
  return success(c, { mfaRequired: true, methods, emailHint: dbUser.email });
}

/** WebAuthn assertion options for verifying account deletion with a passkey. */
export async function startDeletePasskey(c: Context) {
  const user = c.get("user");

  const options = await generatePasskeyAuthOptions(user.sub);
  if (!options.allowCredentials?.length) {
    return error(c, "PASSKEY_NOT_FOUND", "No passkeys registered", 404);
  }

  return success(c, options);
}

export async function sendDeleteCode(c: Context) {
  const user = c.get("user");

  const result = await sendActionCode(user.sub, DELETE_PURPOSE);
  if (!result.ok) {
    return error(
      c,
      result.code,
      result.message,
      result.code === "RATE_LIMITED" ? 429 : undefined,
      result.retryAfter !== undefined ? { retryAfter: result.retryAfter } : undefined,
    );
  }

  return success(c, { sent: true, cooldown: 60 });
}

export async function deleteAccount(c: Context) {
  const user = c.get("user");
  const body = await c.req.json().catch(() => ({}));
  const method = String(body.method || "");

  const userRecord = await db.user.findUnique({
    where: { id: user.sub },
    select: {
      id: true,
      passwordHash: true,
      role: true,
    },
  });

  if (!userRecord) {
    return error(c, "USER_NOT_FOUND", "User not found", 404);
  }

  // Password remains a supported confirmation method (legacy clients / API use).
  if (method === "password") {
    if (!userRecord.passwordHash) {
      return error(c, "INVALID_REQUEST", "Password is not set for this account");
    }
    const valid = await verify(String(body.password || ""), userRecord.passwordHash);
    if (!valid) {
      return error(c, "INVALID_CREDENTIALS", "Invalid password");
    }
  } else {
    // Step-up via challenge (passkey / TOTP / email code)
    const verified = await verifyActionByMethod(user.sub, method || "email", body, DELETE_PURPOSE);
    if (!verified.ok) {
      return error(c, verified.code, verified.message);
    }
  }

  // Prevent admin from deleting themselves (optional safeguard)
  if (userRecord.role === "admin") {
    const adminCount = await db.user.count({ where: { role: "admin" } });
    if (adminCount <= 1) {
      return error(c, "FORBIDDEN", "Cannot delete the last admin account");
    }
  }

  // Delete user and all related data (cascade)
  await db.user.delete({ where: { id: user.sub } });

  return success(c, { deleted: true });
}
