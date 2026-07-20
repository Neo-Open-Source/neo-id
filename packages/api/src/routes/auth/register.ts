import type { Context } from "hono";
import { db } from "@neo-id/db";
import { hash, generateToken } from "@neo-id/auth-core";
import { registerSchema, type RegisterInput } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function register(c: Context) {
  const body = await c.req.json();
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return error(c, "INVALID_REQUEST", parsed.error.errors[0]?.message || "Invalid input");
  }

  const { email, username, password, displayName } = parsed.data as RegisterInput;

  // Check if email exists
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return error(c, "EMAIL_ALREADY_EXISTS", "Email is already registered");
  }

  // Check if username exists
  if (username) {
    const existingUsername = await db.user.findUnique({ where: { username } });
    if (existingUsername) {
      return error(c, "USERNAME_TAKEN", "Username is already taken");
    }
  }

  // Hash password
  const passwordHash = await hash(password);

  // ─── First User Admin Logic ──────────────────────────────────────────────
  // First user gets admin if:
  // 1. No users exist (first run)
  // 2. AND (localhost OR dev mode)
  const userCount = await db.user.count();
  const isFirstUser = userCount === 0;

  const ip = c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "";
  const isLocalhost = ip === "127.0.0.1" || ip === "::1" || ip === "" || ip.includes("localhost");
  const isDev = process.env.NODE_ENV !== "production";

  const role = isFirstUser && (isLocalhost || isDev) ? "admin" : "user";

  // Create user
  const user = await db.user.create({
    data: {
      email,
      username,
      passwordHash,
      displayName: displayName || email.split("@")[0],
      role,
      emailVerified: isFirstUser && (isLocalhost || isDev), // Auto-verify first user in dev
    },
  });

  // Generate email verification token (skip for first user in dev)
  if (!(isFirstUser && (isLocalhost || isDev))) {
    const verifyToken = generateToken(32);
    await db.mfaCode.create({
      data: {
        userId: user.id,
        code: verifyToken,
        purpose: "verify_email",
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      },
    });
    // TODO: Send verification email via Resend
  }

  return success(c, {
    id: user.id,
    email: user.email,
    role: user.role,
    is_first_admin: isFirstUser && role === "admin",
  }, 201);
}
