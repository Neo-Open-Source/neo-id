import type { Context } from "hono";
import type { ErrorCode } from "@neo-id/shared";
import { success, error } from "../../helpers/response";
import {
  getRefreshTokenFromRequest,
  setAuthCookies,
} from "../../helpers/auth-cookies";
import { verifyAndRotateRefreshToken } from "../../helpers/tokens";
import { getRequestInfo } from "../../helpers/request";

export async function refresh(c: Context) {
  let body: Record<string, unknown> = {};
  try {
    body = await c.req.json();
  } catch {
    // Cookie-only refresh has no body
  }

  const refreshToken = getRefreshTokenFromRequest(c, body.refresh_token as string | undefined);

  if (!refreshToken) {
    return error(c, "INVALID_REQUEST", "refresh_token is required");
  }

  const result = await verifyAndRotateRefreshToken(
    refreshToken,
    undefined,
    getRequestInfo(c).ipAddress,
  );

  if (!result.ok) {
    return error(c, result.error as ErrorCode, result.message);
  }

  setAuthCookies(c, result.tokens);

  return success(c, {
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
    idToken: result.tokens.idToken,
  });
}
