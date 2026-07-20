import type { Context } from "hono";
import { db } from "@neo-id/db";
import {
  signAccessToken,
  signIdToken,
  generateToken,
  hashToken,
  constantTimeEqual,
} from "@neo-id/auth-core";
import { TOKEN } from "@neo-id/shared";
import { success, error } from "../../helpers/response";

export async function refresh(c: Context) {
  const body = await c.req.json();
  const refreshToken = body.refresh_token;

  if (!refreshToken) {
    return error(c, "INVALID_REQUEST", "refresh_token is required");
  }

  // Find refresh token by hash
  const tokenHash = hashToken(refreshToken);
  const storedToken = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt) {
    return error(c, "TOKEN_INVALID", "Invalid refresh token");
  }

  // Check expiry
  if (storedToken.expiresAt < new Date()) {
    return error(c, "TOKEN_EXPIRED", "Refresh token has expired");
  }

  const user = storedToken.user;

  if (user.status === "banned") {
    return error(c, "USER_BANNED", "Your account has been banned");
  }

  // Revoke old token
  await db.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date(), revokeReason: "rotated" },
  });

  // Create new session
  const session = await db.session.create({
    data: {
      userId: user.id,
      deviceInfo: storedToken.deviceInfo,
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
    },
  });

  // Generate new tokens
  const newAccessToken = await signAccessToken(
    { sub: user.id, email: user.email, role: user.role },
    session.id
  );
  const idToken = await signIdToken({
    sub: user.id,
    email: user.email,
    role: user.role,
  });

  // Create new refresh token
  const newRefreshToken = generateToken(TOKEN.REFRESH_TOKEN_LENGTH);
  await db.refreshToken.create({
    data: {
      userId: user.id,
      sessionId: session.id,
      tokenHash: hashToken(newRefreshToken),
      parentId: storedToken.id,
      deviceInfo: storedToken.deviceInfo,
      ipAddress: c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP"),
      expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
    },
  });

  return success(c, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    idToken,
  });
}
