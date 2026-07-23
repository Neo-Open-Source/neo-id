import type { Context, Next } from "hono";
import { verifyAccessToken, type JwtPayload } from "@neo-id/auth-core";
import { error } from "../helpers/response";
import { getAccessTokenFromRequest } from "../helpers/auth-cookies";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const token = getAccessTokenFromRequest(c);
  if (!token) {
    return error(c, "UNAUTHORIZED", "Missing or invalid authorization", 401);
  }

  try {
    const payload = await verifyAccessToken(token);
    c.set("user", payload);
    await next();
  } catch {
    return error(c, "TOKEN_INVALID", "Invalid or expired token", 401);
  }
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user");
  if (!user) {
    return error(c, "UNAUTHORIZED", "Authentication required", 401);
  }
  if (user.role !== "admin") {
    return error(c, "FORBIDDEN", "Admin access required", 403);
  }
  await next();
}
