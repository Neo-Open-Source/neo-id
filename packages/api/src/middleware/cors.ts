import type { MiddlewareHandler } from "hono";
import { cors } from "hono/cors";
import { db } from "@neo-id/db";

// Static allow-list: local dev web apps plus any extra origins via the
// CORS_ORIGIN env var (escape hatch for origins not tied to a registered app).
const STATIC_ORIGINS = (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:3001")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Dynamic allow-list: origins derived from the redirect URIs registered on
// active ServiceApps. The trust model: if a domain is trusted enough to
// receive the authorization code (authorize() already validates redirect_uri
// against the registered list), it is equally trusted to exchange that code —
// so the developer portal becomes the single source of truth and no CORS env
// maintenance is needed per app/domain.
let registeredOrigins = new Set<string>();
let registeredLoadedAt = 0;
const REFRESH_TTL_MS = 60_000;

async function refreshRegisteredOrigins(): Promise<void> {
  const now = Date.now();
  if (registeredLoadedAt && now - registeredLoadedAt < REFRESH_TTL_MS) return;
  // Optimistic lock: the first caller runs the DB query; concurrent callers
  // in the same window skip it and serve the (possibly stale) cached list.
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
    // DB temporarily unavailable — clear the lock so the next request retries.
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
