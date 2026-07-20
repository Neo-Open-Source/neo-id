import type { Context } from "hono";
import { db } from "@neo-id/db";
import {
  signAccessToken,
  signIdToken,
  generateToken,
  hashToken,
} from "@neo-id/auth-core";
import { TOKEN } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function pollDeviceToken(c: Context) {
  const body = await c.req.json();
  const { client_id, device_code, grant_type } = body;

  // Validate grant_type
  if (grant_type !== "urn:ietf:params:oauth:grant-type:device_code") {
    return error(c, "INVALID_REQUEST", "Unsupported grant_type");
  }

  if (!client_id || !device_code) {
    return error(c, "INVALID_REQUEST", "client_id and device_code are required");
  }

  // Find device code
  const stored = await db.deviceCode.findUnique({
    where: { deviceCode: device_code },
  });

  if (!stored) {
    return error(c, "INVALID_REQUEST", "Invalid device_code");
  }

  // Check expiration
  if (stored.expiresAt < new Date()) {
    await db.deviceCode.update({
      where: { id: stored.id },
      data: { status: "expired" },
    });
    return error(c, "INVALID_REQUEST", "expired_token");
  }

  // Check status
  if (stored.status === "denied") {
    return error(c, "INVALID_REQUEST", "access_denied");
  }

  if (stored.status === "pending") {
    return error(c, "INVALID_REQUEST", "authorization_pending");
  }

  if (stored.status !== "approved" || !stored.userId) {
    return error(c, "INVALID_REQUEST", "authorization_pending");
  }

  // Get user
  const user = await db.user.findUnique({
    where: { id: stored.userId },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user || user.status === "banned") {
    return error(c, "INVALID_REQUEST", "access_denied");
  }

  // Delete used device code
  await db.deviceCode.delete({ where: { id: stored.id } });

  // Create session
  const session = await db.session.create({
    data: {
      userId: user.id,
      deviceInfo: stored.location || "Device Code Flow",
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
      deviceInfo: stored.location || "Device Code Flow",
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
    },
  });

  return success(c, {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "Bearer",
    expires_in: TOKEN.ACCESS_TOKEN_EXPIRY,
    id_token: idToken,
  });
}
