import { db } from "@neo-id/db";
import { signAccessToken, signIdToken, generateToken, hashToken, lookupIp, formatLocation } from "@neo-id/auth-core";
import { TOKEN, SESSION } from "@neo-id/shared";

interface SessionInfo {
  userId: string;
  email: string;
  role: string;
  deviceInfo?: string;
  ipAddress?: string;
}

interface TokenResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  sessionId: string;
}

async function populateSessionGeo(sessionId: string, ipAddress?: string) {
  if (!ipAddress) return;
  const geo = await lookupIp(ipAddress);
  if (!geo) return;
  const location = formatLocation(geo);
  if (location === "Unknown") return;
  await db.session.update({
    where: { id: sessionId },
    data: { location },
  }).catch(() => {});
}

export async function issueTokens(info: SessionInfo): Promise<TokenResult> {
  const session = await db.session.create({
    data: {
      userId: info.userId,
      deviceInfo: info.deviceInfo,
      ipAddress: info.ipAddress,
      expiresAt: new Date(Date.now() + SESSION.INACTIVITY_TIMEOUT * 1000),
    },
  });

  void populateSessionGeo(session.id, info.ipAddress);

  const accessToken = await signAccessToken(
    { sub: info.userId, email: info.email, role: info.role },
    session.id,
  );

  const idToken = await signIdToken({
    sub: info.userId,
    email: info.email,
    role: info.role,
  });

  const refreshToken = generateToken(TOKEN.REFRESH_TOKEN_LENGTH);
  await db.refreshToken.create({
    data: {
      userId: info.userId,
      sessionId: session.id,
      tokenHash: hashToken(refreshToken),
      deviceInfo: info.deviceInfo,
      ipAddress: info.ipAddress,
      expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
    },
  });

  await db.user.update({
    where: { id: info.userId },
    data: { lastLoginAt: new Date(), lastLoginIp: info.ipAddress },
  });

  return { accessToken, refreshToken, idToken, sessionId: session.id };
}

type RefreshError = { ok: false; error: string; message: string };
type RefreshSuccess = { ok: true; tokens: TokenResult; user: { id: string; email: string; role: string } };

export async function verifyAndRotateRefreshToken(
  rawToken: string,
  deviceInfo?: string,
  ipAddress?: string,
): Promise<RefreshError | RefreshSuccess> {
  const tokenHash = hashToken(rawToken);
  const storedToken = await db.refreshToken.findUnique({
    where: { tokenHash },
    include: { user: true },
  });

  if (!storedToken || storedToken.revokedAt) {
    return { ok: false, error: "TOKEN_INVALID", message: "Invalid refresh token" };
  }

  if (storedToken.expiresAt < new Date()) {
    return { ok: false, error: "TOKEN_EXPIRED", message: "Refresh token has expired" };
  }

  const user = storedToken.user;
  if (user.status === "banned") {
    return { ok: false, error: "USER_BANNED", message: "Your account has been banned" };
  }

  if (!storedToken.sessionId) {
    return { ok: false, error: "INVALID_REQUEST", message: "Invalid session" };
  }

  await db.refreshToken.update({
    where: { id: storedToken.id },
    data: { revokedAt: new Date(), revokeReason: "rotated" },
  });

  const tokens = await rotateSessionTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
    sessionId: storedToken.sessionId,
    oldRefreshTokenId: storedToken.id,
    deviceInfo: deviceInfo ?? storedToken.deviceInfo ?? undefined,
    ipAddress,
  });

  return { ok: true, tokens, user };
}

export async function rotateSessionTokens(info: {
  userId: string;
  email: string;
  role: string;
  sessionId: string;
  oldRefreshTokenId: string;
  deviceInfo?: string;
  ipAddress?: string;
}): Promise<TokenResult> {
  await db.session.update({
    where: { id: info.sessionId },
    data: {
      lastActiveAt: new Date(),
      ipAddress: info.ipAddress,
      deviceInfo: info.deviceInfo,
      expiresAt: new Date(Date.now() + SESSION.INACTIVITY_TIMEOUT * 1000),
    },
  });

  void populateSessionGeo(info.sessionId, info.ipAddress);

  const accessToken = await signAccessToken(
    { sub: info.userId, email: info.email, role: info.role },
    info.sessionId,
  );

  const idToken = await signIdToken({
    sub: info.userId,
    email: info.email,
    role: info.role,
  });

  const newRefreshToken = generateToken(TOKEN.REFRESH_TOKEN_LENGTH);
  await db.refreshToken.create({
    data: {
      userId: info.userId,
      sessionId: info.sessionId,
      tokenHash: hashToken(newRefreshToken),
      parentId: info.oldRefreshTokenId,
      deviceInfo: info.deviceInfo,
      ipAddress: info.ipAddress,
      expiresAt: new Date(Date.now() + TOKEN.REFRESH_TOKEN_EXPIRY * 1000),
    },
  });

  return { accessToken, refreshToken: newRefreshToken, idToken, sessionId: info.sessionId };
}
