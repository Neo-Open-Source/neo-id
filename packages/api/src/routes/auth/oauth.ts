import type { Context } from "hono";
import { db } from "@neo-id/db";
import { OAUTH_PROVIDERS } from "@neo-id/shared";
import { generateToken, verifyAccessToken } from "@neo-id/auth-core";
import { cacheExternalAvatar } from "../../helpers/avatar";
import { issueTokens } from "../../helpers/tokens";
import {
  createOAuthStateToken,
  exchangeSocialCode,
  getSocialAuthorizationUrl,
  isSocialOAuthConfigured,
} from "../../helpers/social-oauth";
import { getRequestInfo } from "../../helpers/request";
import { success, error } from "../../helpers/response";
import { setAuthCookies } from "../../helpers/auth-cookies";

const WEB_URL = process.env.WEB_URL || "http://localhost:3001";
const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

function isProvider(value: string): value is (typeof OAUTH_PROVIDERS)[number] {
  return (OAUTH_PROVIDERS as readonly string[]).includes(value);
}

function redirectWithError(webUrl: string, message: string) {
  const url = new URL("/auth", webUrl);
  url.searchParams.set("oauth_error", message);
  return url.toString();
}

export async function startSocialOAuth(c: Context) {
  const rawProvider = c.req.param("provider");
  if (!rawProvider) return error(c, "INVALID_REQUEST", "Provider is required");
  const provider = rawProvider;
  const mode = c.req.query("mode") === "link" ? "link" : "login";
  const returnTo = c.req.query("return_to") || `${WEB_URL}/profile`;

  return beginSocialOAuth(c, provider, mode, returnTo);
}

export async function startSocialOAuthLink(c: Context) {
  const rawProvider = c.req.param("provider");
  if (!rawProvider) return error(c, "INVALID_REQUEST", "Provider is required");
  const provider = rawProvider;
  const body = await c.req.json().catch(() => ({}));
  const returnTo = (body.return_to as string | undefined) || `${WEB_URL}/profile`;

  return beginSocialOAuth(c, provider, "link", returnTo, c.get("user").sub);
}

async function beginSocialOAuth(
  c: Context,
  provider: string,
  mode: "login" | "link",
  returnTo: string,
  linkedUserId?: string,
) {

  if (!isProvider(provider)) {
    return error(c, "INVALID_REQUEST", "Unsupported provider");
  }

  if (!isSocialOAuthConfigured(provider)) {
    return error(c, "SERVICE_UNAVAILABLE", `${provider} OAuth is not configured`, 503);
  }

  let userId: string | undefined = linkedUserId;

  if (mode === "link" && !userId) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return error(c, "UNAUTHORIZED", "Authentication required", 401);
    }
    try {
      const payload = await verifyAccessToken(authHeader.slice(7));
      userId = payload.sub;
    } catch {
      return error(c, "UNAUTHORIZED", "Invalid token", 401);
    }
  }

  const state = createOAuthStateToken();

  await db.oAuthState.create({
    data: {
      state,
      provider,
      mode,
      userId,
      redirectUri: returnTo,
      expiresAt: new Date(Date.now() + OAUTH_STATE_TTL_MS),
    },
  });

  const authUrl = getSocialAuthorizationUrl(provider, state);

  if (linkedUserId || mode === "link") {
    return success(c, { url: authUrl });
  }

  return c.redirect(authUrl, 302);
}

export async function socialOAuthCallback(c: Context) {
  const provider = c.req.param("provider") || "";
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");

  if (oauthError) {
    return c.redirect(redirectWithError(WEB_URL, oauthError), 302);
  }

  if (!isProvider(provider) || !code || !state) {
    return c.redirect(redirectWithError(WEB_URL, "invalid_request"), 302);
  }

  const oauthState = await db.oAuthState.findUnique({ where: { state } });
  if (!oauthState || oauthState.expiresAt < new Date() || oauthState.provider !== provider) {
    return c.redirect(redirectWithError(WEB_URL, "expired_state"), 302);
  }

  await db.oAuthState.delete({ where: { id: oauthState.id } });

  let userInfo;
  try {
    userInfo = await exchangeSocialCode(provider, code);
  } catch {
    return c.redirect(redirectWithError(WEB_URL, "token_exchange_failed"), 302);
  }

  if (!userInfo.email) {
    return c.redirect(redirectWithError(WEB_URL, "email_required"), 302);
  }

  const { deviceInfo, ipAddress } = getRequestInfo(c);

  if (oauthState.mode === "link" && oauthState.userId) {
    const existing = await db.identity.findUnique({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: userInfo.id,
        },
      },
    });

    if (existing && existing.userId !== oauthState.userId) {
      return c.redirect(redirectWithError(WEB_URL, "account_already_linked"), 302);
    }

    await db.identity.upsert({
      where: {
        provider_providerUserId: {
          provider,
          providerUserId: userInfo.id,
        },
      },
      create: {
        userId: oauthState.userId,
        provider,
        providerUserId: userInfo.id,
      },
      update: {
        userId: oauthState.userId,
      },
    });

    if (userInfo.picture) {
      const user = await db.user.findUnique({
        where: { id: oauthState.userId },
        select: { avatar: true },
      });
      if (!user?.avatar) {
        await cacheExternalAvatar(oauthState.userId, userInfo.picture);
      }
    }

    const returnTo = oauthState.redirectUri || `${WEB_URL}/profile`;
    const url = new URL(returnTo);
    url.searchParams.set("oauth_linked", provider);
    return c.redirect(url.toString(), 302);
  }

  const identity = await db.identity.findUnique({
    where: {
      provider_providerUserId: {
        provider,
        providerUserId: userInfo.id,
      },
    },
    include: { user: true },
  });

  let user = identity?.user;

  if (!user) {
    const found = await db.user.findUnique({ where: { email: userInfo.email } });
    user = found ?? undefined;

    if (user) {
      await db.identity.create({
        data: {
          userId: user.id,
          provider,
          providerUserId: userInfo.id,
        },
      });
    } else {
      const names = userInfo.name?.split(" ") ?? [];
      user = await db.user.create({
        data: {
          email: userInfo.email,
          emailVerified: true,
          displayName: userInfo.name,
          firstName: names[0],
          lastName: names.slice(1).join(" ") || undefined,
          avatar: userInfo.picture,
          identities: {
            create: {
              provider,
              providerUserId: userInfo.id,
            },
          },
        },
      });
    }
  }

  if (user.status === "banned") {
    return c.redirect(redirectWithError(WEB_URL, "user_banned"), 302);
  }

  if (userInfo.picture && !user.avatar) {
    await cacheExternalAvatar(user.id, userInfo.picture);
  }

  const passkeyCount = await db.passkey.count({ where: { userId: user.id } });
  const hasMfa = user.totpEnabled || user.emailMfaEnabled;

  const returnTo = oauthState.redirectUri || `${WEB_URL}/profile`;

  if (hasMfa) {
    const mfaMethods = [
      ...(passkeyCount > 0 ? ["passkey"] : []),
      ...(user.totpEnabled ? ["totp"] : []),
      ...(user.emailMfaEnabled ? ["email"] : []),
    ];
    const mfaUrl = new URL("/auth/2fa", WEB_URL);
    mfaUrl.searchParams.set("email", user.email);
    mfaUrl.searchParams.set("methods", mfaMethods.join(","));
    mfaUrl.searchParams.set("oauth_ticket", generateToken(32));
    mfaUrl.searchParams.set("redirect", returnTo);
    if (user.emailMfaEnabled) mfaUrl.searchParams.set("emailHint", user.email);
    return c.redirect(mfaUrl.toString(), 302);
  }

  const tokens = await issueTokens({
    userId: user.id,
    email: user.email,
    role: user.role,
    deviceInfo,
    ipAddress,
  });

  const ticket = generateToken(32);
  await db.oAuthState.create({
    data: {
      state: ticket,
      mode: "ticket",
      userId: user.id,
      codeVerifier: JSON.stringify({
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }),
      expiresAt: new Date(Date.now() + 60 * 1000),
    },
  });

  const completeUrl = new URL("/auth/oauth/complete", WEB_URL);
  completeUrl.searchParams.set("ticket", ticket);
  completeUrl.searchParams.set("return_to", returnTo);
  return c.redirect(completeUrl.toString(), 302);
}

export async function completeSocialOAuth(c: Context) {
  const body = await c.req.json();
  const ticket = body.ticket as string | undefined;

  if (!ticket) {
    return error(c, "INVALID_REQUEST", "ticket is required");
  }

  const oauthState = await db.oAuthState.findUnique({ where: { state: ticket } });
  if (!oauthState || oauthState.mode !== "ticket" || oauthState.expiresAt < new Date()) {
    return error(c, "INVALID_REQUEST", "Invalid or expired ticket");
  }

  await db.oAuthState.delete({ where: { id: oauthState.id } });

  const tokens = JSON.parse(oauthState.codeVerifier || "{}") as {
    accessToken?: string;
    refreshToken?: string;
  };

  if (!tokens.accessToken || !tokens.refreshToken) {
    return error(c, "INVALID_REQUEST", "Invalid ticket");
  }

  setAuthCookies(c, {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });

  const user = await db.user.findUnique({
    where: { id: oauthState.userId! },
    select: { id: true, email: true, displayName: true, role: true },
  });

  return c.json({
    ok: true,
    data: {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user,
    },
  });
}
