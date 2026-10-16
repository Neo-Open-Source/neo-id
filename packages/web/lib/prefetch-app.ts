import { api, ensureSession } from "@/lib/api";
import { readCache, writeCache } from "@/lib/cache";

export async function prefetchApp(): Promise<void> {
  const ok = await ensureSession().catch(() => false);
  if (!ok) return;
  if (!readCache("/user/profile")) {
    const profile = await api("/user/profile").catch(() => null);
    if (profile) writeCache("/user/profile", profile);
  }
  if (!readCache("/sessions")) {
    api("/sessions").then(
      (data) => writeCache("/sessions", data),
      () => undefined,
    );
  }
}

export function prefetchAppBounded(timeoutMs = 2500): Promise<void> {
  return Promise.race([
    prefetchApp(),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
