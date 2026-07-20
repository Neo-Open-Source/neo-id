import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

export const corsMiddleware: MiddlewareHandler = cors({
  origin: process.env.CORS_ORIGIN || "*",
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
