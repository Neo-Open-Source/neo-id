import { db } from "@neo-id/db";

const CLEANUP_INTERVAL_MS = 60_000 * 60;

export async function cleanupSessions() {
  const inactive = await db.session.findMany({
    where: { isActive: false },
    select: { id: true },
  });

  if (inactive.length > 0) {
    const ids = inactive.map((s) => s.id);

    await db.$transaction([
      db.refreshToken.deleteMany({ where: { sessionId: { in: ids } } }),
      db.session.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }
}

async function cleanupExpiredRecords() {
  const now = new Date();
  await Promise.all([
    db.mfaCode.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.oAuthState.deleteMany({ where: { expiresAt: { lt: now } } }),
    db.deviceCode.deleteMany({ where: { expiresAt: { lt: now } } }),
  ]);
}

export async function runCleanup() {
  await Promise.all([
    cleanupSessions(),
    cleanupExpiredRecords(),
  ]);
}

let started = false;

export function startCleanup() {
  if (started) return;
  started = true;

  runCleanup().catch((err) => console.error("[cleanup] error:", err));

  setInterval(() => {
    runCleanup().catch((err) => console.error("[cleanup] error:", err));
  }, CLEANUP_INTERVAL_MS);
}
