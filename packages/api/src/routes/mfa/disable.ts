import type { Context } from "hono";
import { db } from "@neo-id/db";
import { success, error } from "../../helpers/response";
import {
  getAvailableMethods,
  sendActionCode,
  generatePasskeyAuthOptions,
} from "../../helpers/action-challenge";
import { maskEmail } from "../../helpers/mfa-code";

const DISABLE_PURPOSE = "mfa_disable";

/** Step-up challenge for disabling MFA (passkey / TOTP / email code). */
export async function mfaDisableChallenge(c: Context) {
  const user = c.get("user");

  const dbUser = await db.user.findUnique({
    where: { id: user.sub },
    select: { email: true },
  });

  if (!dbUser) return error(c, "USER_NOT_FOUND", "User not found", 404);

  const methods = await getAvailableMethods(user.sub);
  return success(c, {
    mfaRequired: true,
    methods,
    email: dbUser.email,
    emailHint: maskEmail(dbUser.email),
  });
}

export async function sendMfaDisableCode(c: Context) {
  const user = c.get("user");

  const result = await sendActionCode(user.sub, DISABLE_PURPOSE);
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

/** WebAuthn assertion options for verifying MFA disable with a passkey. */
export async function startMfaDisablePasskey(c: Context) {
  const options = await generatePasskeyAuthOptions(c.get("user").sub);
  if (!options.allowCredentials?.length) {
    return error(c, "PASSKEY_NOT_FOUND", "No passkeys registered", 404);
  }

  return success(c, options);
}
