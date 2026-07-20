import type { Context, Next } from "hono";
import { verifyAccessToken, type JwtPayload } from "@neo-id/auth-core";
import { error } from "../helpers/response";

declare module "hono" {
  interface ContextVariableMap {
    user: JwtPayload;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return error(c, "UNAUTHORIZED", "Missing or invalid authorization header", 401);
  }

  const token = authHeader.slice(7);
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
  if (!user || user.role !== "admin") {
    return error(c, "FORBIDDEN", "Admin access required", 403);
  }
  await next();
}
