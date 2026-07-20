import type { Context } from "hono";
import { db } from "@neo-id/db";

export async function setupCheck(c: Context) {
  const userCount = await db.user.count();

  return c.json({
    ok: true,
    data: {
      needs_setup: userCount === 0,
    },
    meta: {
      request_id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
    },
  });
}
