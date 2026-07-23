import type { Context } from "hono";
import { db } from "@neo-id/db";
import { hash, generateToken, generateCode } from "@neo-id/auth-core";
import { registerSchema, EMAIL } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { validate } from "../../helpers/request";
import { sendEmailVerificationEmail } from "../../helpers/email";
import { verifyTurnstileToken } from "../../helpers/turnstile";
import { normalizeEmail } from "../../helpers/mfa-code";

export async function register(c: Context) {
  const body = await c.req.json();
  const parsed = validate(registerSchema, body);
  if (!parsed.success) return error(c, "INVALID_REQUEST", parsed.error);

  const { username, password, displayName } = parsed.data;
  const email = normalizeEmail(parsed.data.email);

  if (process.env.NODE_ENV === "production") {
    const turnstileToken = body.cfTurnstileToken as string | undefined;
    const valid = await verifyTurnstileToken(
      turnstileToken || "",
      c.req.header("X-Forwarded-For")
    );
    if (!valid) {
      return error(c, "RATE_LIMITED", "Security check failed", 429);
    }
  }

  const existing = await db.user.findUnique({
    where: { email },
    include: { identities: { take: 1 } },
  });

  if (existing) {
    if (existing.emailVerified || existing.identities.length > 0) {
      return error(c, "EMAIL_ALREADY_EXISTS", "Email is already registered");
    }
    await db.user.delete({ where: { id: existing.id } });
  }

  if (username) {
    const existingUsername = await db.user.findFirst({
      where: { username },
      include: { identities: { take: 1 } },
    });
    if (existingUsername) {
      if (!existingUsername.emailVerified && existingUsername.identities.length === 0) {
        await db.user.delete({ where: { id: existingUsername.id } });
      } else {
        return error(c, "USERNAME_TAKEN", "Username is already taken");
      }
    }
  }

  const passwordHash = await hash(password);

  const userCount = await db.user.count();
  const isFirstUser = userCount === 0;

  const ip = c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "";
  const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip === "" || ip.includes("localhost");
  const isDev = process.env.NODE_ENV !== "production";
  const isAutoAdmin = isFirstUser && (isLocalhost || isDev);

  const user = await db.user.create({
    data: {
      email,
      username,
      passwordHash,
      displayName: displayName || email.split("@")[0],
      role: isAutoAdmin ? "admin" : "user",
      emailVerified: isAutoAdmin,
    },
  });

  if (!isAutoAdmin) {
    const verifyCode = generateCode(EMAIL.CODE_LENGTH);
    const verifyToken = generateToken(32);
    const webUrl = process.env.WEB_URL || "http://localhost:3001";
    const verifyLink = `${webUrl}/auth/verify-email?token=${verifyToken}`;

    await db.mfaCode.create({
      data: {
        userId: user.id,
        code: verifyToken,
        purpose: "verify_email_link",
        usedAt: null,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await db.mfaCode.create({
      data: {
        userId: user.id,
        code: verifyCode,
        purpose: "verify_email",
        usedAt: null,
        expiresAt: new Date(Date.now() + EMAIL.CODE_EXPIRY * 1000),
      },
    });

    await sendEmailVerificationEmail(user.email, verifyCode, verifyLink);
  }

  return success(c, {
    id: user.id,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    is_first_admin: isFirstUser && isAutoAdmin,
  }, 201);
}
