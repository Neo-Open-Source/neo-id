import type { Context } from "hono";
import { db } from "@neo-id/db";
import { generateToken, verifyAccessToken } from "@neo-id/auth-core";
import { success, error } from "../../helpers/response";
import { getAccessTokenFromRequest } from "../../helpers/auth-cookies";

/** GET /api/v1/oauth/consent/:session — возвращает данные приложения для отображения */
export async function consentInfo(c: Context) {
  const session = c.req.param("session");
  if (!session) return error(c, "INVALID_REQUEST", "session is required");

  const pendingState = await db.oAuthState.findUnique({ where: { id: session } });

  if (!pendingState || pendingState.mode !== "pending" || pendingState.expiresAt < new Date()) {
    return error(c, "INVALID_REQUEST", "Invalid or expired consent session");
  }

  const app = pendingState.serviceAppId
    ? await db.serviceApp.findUnique({
        where: { id: pendingState.serviceAppId },
        select: { name: true, displayName: true, logoUrl: true, allowedScopes: true },
      })
    : null;

  return success(c, {
    client_name: app?.displayName || app?.name || "Unknown App",
    client_logo: app?.logoUrl ?? null,
    scopes: app?.allowedScopes ?? [],
    redirect_uri: pendingState.redirectUri,
  });
}

/** POST /api/v1/oauth/consent — подтвердить или отклонить */
export async function consent(c: Context) {
  const token = getAccessTokenFromRequest(c);
  if (!token) return error(c, "UNAUTHORIZED", "Not authenticated", 401);

  let userId: string;
  try {
    const payload = await verifyAccessToken(token);
    userId = payload.sub;
  } catch {
    return error(c, "UNAUTHORIZED", "Invalid token", 401);
  }

  const body = await c.req.json<{ session: string; approved: boolean }>();
  const { session, approved } = body;
  if (!session) return error(c, "INVALID_REQUEST", "session is required");

  const pendingState = await db.oAuthState.findUnique({ where: { id: session } });

  if (
    !pendingState ||
    pendingState.mode !== "pending" ||
    pendingState.userId !== userId ||
    pendingState.expiresAt < new Date() ||
    !pendingState.redirectUri
  ) {
    return error(c, "INVALID_REQUEST", "Invalid or expired consent session");
  }

  const redirectUri = pendingState.redirectUri;

  const setStateParam = (url: URL, state: string | null) => {
    if (typeof state === "string" && state !== "") url.searchParams.set("state", state);
  };

  if (!approved) {
    await db.oAuthState.delete({ where: { id: session } });
    const denyUrl = new URL(redirectUri);
    denyUrl.searchParams.set("error", "access_denied");
    denyUrl.searchParams.set("error_description", "User denied access");
    setStateParam(denyUrl, pendingState.state);
    return success(c, { redirect_url: denyUrl.toString() });
  }

  const code = generateToken(32);
  await db.oAuthState.update({
    where: { id: session },
    data: { code, mode: "authorize", expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
  });

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  setStateParam(redirectUrl, pendingState.state);

  return success(c, { redirect_url: redirectUrl.toString() });
}
