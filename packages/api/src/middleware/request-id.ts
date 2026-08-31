import type { MiddlewareHandler } from "hono";
import { generateId } from "@neo-id/auth-core";

export const requestIdMiddleware: MiddlewareHandler = async (c, next) => {
  const requestId = c.req.header("X-Request-ID") || generateId();
  c.set("requestId", requestId);
  c.header("X-Request-ID", requestId);
  await next();
};
