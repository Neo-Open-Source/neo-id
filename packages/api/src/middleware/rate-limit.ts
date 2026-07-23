import type { Context, Next } from "hono";
import { RATE_LIMITS } from "@neo-id/shared";
import { error } from "../helpers/response";

type LimitKey = keyof typeof RATE_LIMITS;
type Bucket = Map<string, { count: number; resetAt: number }>;

const buckets = new Map<LimitKey, Bucket>();

const CLEANUP_INTERVAL = 60_000;
let lastCleanup = Date.now();

function getBucket(key: LimitKey): Bucket {
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = new Map();
    buckets.set(key, bucket);
  }
  return bucket;
}

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;
  for (const [, bucket] of buckets) {
    for (const [ip, entry] of bucket) {
      if (now > entry.resetAt) bucket.delete(ip);
    }
  }
}

export function rateLimit(limitKey: LimitKey) {
  return async (c: Context, next: Next) => {
    const config = RATE_LIMITS[limitKey];
    if (!config) return next();

    const ip = c.req.header("X-Forwarded-For") || c.req.header("X-Real-IP") || "unknown";
    const bucket = getBucket(limitKey);
    const now = Date.now();
    const entry = bucket.get(ip);

    if (!entry || now > entry.resetAt) {
      bucket.set(ip, { count: 1, resetAt: now + config.window * 1000 });
      cleanup();
      return next();
    }

    entry.count += 1;
    if (entry.count > config.limit) {
      return error(c, "RATE_LIMITED", `Too many requests. Try again later.`, 429);
    }

    cleanup();
    return next();
  };
}
