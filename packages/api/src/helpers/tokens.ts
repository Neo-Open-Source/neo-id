import type { Context } from "hono";
import { db } from "@neo-id/db";
import { signAccessToken, signIdToken, generateToken, hashToken, verifyAccessToken, lookupIp, formatLocation } from "@neo-id/auth-core";
import { TOKEN, SESSION } from "@neo-id/shared";
import { getAccessTokenFromRequest, getRefreshTokenFromRequest } from "./auth-cookies";

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

export async function issueTokens(info: SessionInfo, reuseSessionId?: string): Promise<TokenResult> {
  let session: { id: string } | undefined;

  // OAuth code exchanges reuse the session the user already has in the browser
  // (carried through OAuthState) instead of minting a fresh Session per app.
  // Fall back to a new session if the stored one was revoked/expired meanwhile.
  if (reuseSessionId) {
    const existing = await db.session.findUnique({ where: { id: reuseSessionId } });
    if (existing?.isActive && existing.userId === info.userId) {
      session = await db.session.update({
        where: { id: existing.id },
        data: {
          lastActiveAt: new Date(),
          ipAddress: info.ipAddress,
          deviceInfo: info.deviceInfo,
          expiresAt: new Date(Date.now() + SESSION.INACTIVITY_TIMEOUT * 1000),
        },
      });
    }
  }

  if (!session) {
    session = await db.session.create({
      data: {
        userId: info.userId,
        deviceInfo: info.deviceInfo,
        ipAddress: info.ipAddress,
        expiresAt: new Date(Date.now() + SESSION.INACTIVITY_TIMEOUT * 1000),
      },
    });
  }

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

/**
 * Find the session this browser already holds for the user so a re-login
 * (password / MFA / passkey / social) reuses it instead of minting a duplicate.
 * Mirrors what the OAuth code exchange already does via OAuthState.sessionId.
 * Returns undefined when the browser has no active session for the user.
 */
export async function getReusableSessionId(
  c: Context,
  userId: string,
): Promise<string | undefined> {
  // 1) Access token (already validated by requireAuth where applicable)
  const accessToken = getAccessTokenFromRequest(c);
  if (accessToken) {
    try {
      const payload = await verifyAccessToken(accessToken);
      if (payload.sub === userId && payload.session_id) return payload.session_id;
    } catch {
      // expired / invalid — fall through to refresh token
    }
  }

  // 2) Refresh token (httpOnly cookie, or body token when the edge drops cookies)
  // Hono memoizes c.req.json(), so re-reading the body here is cheap.
  let bodyToken: string | undefined;
  try {
    const body = await c.req.json();
    bodyToken = (body as Record<string, unknown>).refresh_token as string | undefined;
  } catch {
    // no JSON body
  }
  const refreshToken = getRefreshTokenFromRequest(c, bodyToken);
  if (refreshToken) {
    const stored = await db.refreshToken.findUnique({
      where: { tokenHash: hashToken(refreshToken) },
      select: { sessionId: true, userId: true },
    });
    if (stored?.sessionId && stored.userId === userId) {
      const session = await db.session.findUnique({ where: { id: stored.sessionId } });
      if (session?.isActive) return session.id;
    }
  }

  return undefined;
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

  if (!storedToken) {
    return { ok: false, error: "TOKEN_INVALID", message: "Invalid refresh token" };
  }

  // Grace period: concurrent tabs / retry after Set-Cookie lag often re-present
  // a token that was just rotated. Re-issue for the same session instead of logout.
  if (storedToken.revokedAt) {
    const rotatedRecently =
      storedToken.revokeReason === "rotated" &&
      Date.now() - storedToken.revokedAt.getTime() < TOKEN.REUSE_DETECTION_WINDOW * 1000;

    if (!rotatedRecently || !storedToken.sessionId) {
      return { ok: false, error: "TOKEN_INVALID", message: "Invalid refresh token" };
    }

    const user = storedToken.user;
    if (user.status === "banned") {
      return { ok: false, error: "USER_BANNED", message: "Your account has been banned" };
    }

    const session = await db.session.findUnique({ where: { id: storedToken.sessionId } });
    if (!session || !session.isActive) {
      return { ok: false, error: "TOKEN_INVALID", message: "Session is no longer active" };
    }

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

  const session = await db.session.findUnique({ where: { id: storedToken.sessionId } });
  if (!session || !session.isActive) {
    return { ok: false, error: "TOKEN_INVALID", message: "Session is no longer active" };
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
