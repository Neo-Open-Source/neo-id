import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";

const ALLOWED_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

export const corsMiddleware: MiddlewareHandler = cors({
  origin: (origin) => {
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return origin;
    return ALLOWED_ORIGINS[0] || "http://localhost:3001";
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
