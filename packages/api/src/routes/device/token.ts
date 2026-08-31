import type { Context } from "hono";
import { db } from "@neo-id/db";
import { TOKEN } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import { issueTokens } from "../../helpers/tokens";

export async function pollDeviceToken(c: Context) {
  const body = await c.req.json();
  const { client_id, device_code, grant_type } = body;

  if (grant_type !== "urn:ietf:params:oauth:grant-type:device_code") {
    return error(c, "INVALID_REQUEST", "Unsupported grant_type");
  }

  if (!client_id || !device_code) {
    return error(c, "INVALID_REQUEST", "client_id and device_code are required");
  }

  const stored = await db.deviceCode.findUnique({
    where: { deviceCode: device_code },
  });

  if (!stored) {
    return error(c, "INVALID_REQUEST", "Invalid device_code");
  }

  if (stored.expiresAt < new Date()) {
    await db.deviceCode.update({ where: { id: stored.id }, data: { status: "expired" } });
    return error(c, "INVALID_REQUEST", "expired_token");
  }

  if (stored.status === "denied") {
    return error(c, "INVALID_REQUEST", "access_denied");
  }

  if (stored.status !== "approved" || !stored.userId) {
    return error(c, "INVALID_REQUEST", "authorization_pending");
  }

  const user = await db.user.findUnique({
    where: { id: stored.userId },
    select: { id: true, email: true, role: true, status: true },
  });

  if (!user || user.status === "banned") {
    return error(c, "INVALID_REQUEST", "access_denied");
  }

  await db.deviceCode.delete({ where: { id: stored.id } });

  const tokens = await issueTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
    deviceInfo: stored.location || "Device Code Flow",
    ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
  });

  return success(c, {
    access_token: tokens.accessToken,
    refresh_token: tokens.refreshToken,
    token_type: "Bearer",
    expires_in: TOKEN.ACCESS_TOKEN_EXPIRY,
    id_token: tokens.idToken,
  });
}
