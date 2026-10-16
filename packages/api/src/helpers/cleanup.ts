import type { PrismaClient } from "@neo-id/db";
import { db as nodeDb, getWorkersDb } from "@neo-id/db";
import { isWorkersRuntime } from "@neo-id/shared";

const CLEANUP_INTERVAL_MS = 60_000 * 60;

export async function cleanupSessions(client: PrismaClient) {
  const inactive = await client.session.findMany({
    where: { isActive: false },
    select: { id: true },
  });

  if (inactive.length > 0) {
    const ids = inactive.map((s) => s.id);

    await client.$executeRawUnsafe(`DELETE FROM "refresh_tokens" WHERE "sessionId" = ANY($1)`, ids);
    await client.$executeRawUnsafe(`DELETE FROM "sessions" WHERE "id" = ANY($1)`, ids);
  }
}

async function cleanupExpiredRecords(client: PrismaClient) {
  const now = new Date();
  await Promise.all([
    client.$executeRawUnsafe(`DELETE FROM "mfa_codes" WHERE "expiresAt" < $1`, now),
    client.$executeRawUnsafe(`DELETE FROM "oauth_states" WHERE "expiresAt" < $1`, now),
    client.$executeRawUnsafe(`DELETE FROM "device_codes" WHERE "expiresAt" < $1`, now),
  ]);
}

function resolveClient(env?: { DATABASE_URL?: string }): PrismaClient {
  if (isWorkersRuntime()) return getWorkersDb(env?.DATABASE_URL ?? "");
  return nodeDb;
}

export async function runCleanup(env?: { DATABASE_URL?: string }) {
  const client = resolveClient(env);
  await Promise.all([
    cleanupSessions(client),
    cleanupExpiredRecords(client),
  ]);
}

let started = false;

export async function scheduled(_controller?: unknown, env?: { DATABASE_URL?: string }): Promise<void> {
  await runCleanup(env);
}

export function startCleanup(client?: PrismaClient) {
  if (started || isWorkersRuntime()) return;
  started = true;
  const resolved = client ?? nodeDb;

  setTimeout(() => {
    Promise.all([cleanupSessions(resolved), cleanupExpiredRecords(resolved)])
      .catch((err) => console.error("[cleanup] error:", err));
  }, 60_000);

  setInterval(() => {
    Promise.all([cleanupSessions(resolved), cleanupExpiredRecords(resolved)])
      .catch((err) => console.error("[cleanup] error:", err));
  }, CLEANUP_INTERVAL_MS);
}
