import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { db } from "@neo-id/db";

const STATIC_ORIGINS = (process.env.CORS_ORIGIN || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

let registeredOrigins = new Set<string>();
let registeredLoadedAt = 0;
const REFRESH_TTL_MS = 60_000;

async function refreshRegisteredOrigins(): Promise<void> {
  const now = Date.now();
  if (registeredLoadedAt && now - registeredLoadedAt < REFRESH_TTL_MS) return;
  registeredLoadedAt = now;
  try {
    const apps = await db.serviceApp.findMany({
      where: { isActive: true },
      select: { redirectUris: true },
    });
    const origins = new Set<string>();
    for (const app of apps) {
      for (const raw of app.redirectUris ?? []) {
        const uri = raw.trim();
        if (!uri) continue;
        try {
          origins.add(new URL(uri).origin);
        } catch {
          /* malformed redirect URI — ignore */
        }
      }
    }
    registeredOrigins = origins;
  } catch {
    registeredLoadedAt = 0;
  }
}

export const corsMiddleware: MiddlewareHandler = cors({
  origin: async (origin) => {
    if (!origin || STATIC_ORIGINS.includes(origin)) return origin || null;
    await refreshRegisteredOrigins();
    return registeredOrigins.has(origin) ? origin : null;
  },
  allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowHeaders: ["Content-Type", "Authorization"],
  credentials: true,
});
