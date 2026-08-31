interface CacheEntry {
  data: unknown;
  writtenAt: number;
}

const store = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();

// Persisted copies are only trusted while fresh; stale ones are dropped so the
// next read falls back to the network.
export const CACHE_PERSIST_TTL_MS = 5 * 60_000; // 5 minutes
const STORAGE_PREFIX = "neo_id_cache:";

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function readStorage(key: string): CacheEntry | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_PREFIX + key);
    if (!raw) return null;
    return JSON.parse(raw) as CacheEntry;
  } catch {
    return null;
  }
}

function writeStorage(key: string, entry: CacheEntry) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_PREFIX + key, JSON.stringify(entry));
  } catch {
    // private mode / blocked storage — memory only
  }
}

function removeStorage(key: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(STORAGE_PREFIX + key);
  } catch {
    // ignore
  }
}

export function subscribeCache(key: string, listener: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => {
    listeners.get(key)?.delete(listener);
  };
}

export function readCache<T>(key: string): T | null {
  const mem = store.get(key);
  if (mem) return mem.data as T;

  // Hydrate from sessionStorage when the persisted copy is still fresh —
  // lets a reload paint cached data instantly instead of a full-screen spinner.
  const persisted = readStorage(key);
  if (persisted && Date.now() - persisted.writtenAt < CACHE_PERSIST_TTL_MS) {
    store.set(key, persisted);
    return persisted.data as T;
  }
  return null;
}

/** Age of the freshest copy (memory or storage) in ms, or null when absent. */
export function getCacheAge(key: string): number | null {
  const mem = store.get(key);
  if (mem) return Date.now() - mem.writtenAt;

  const persisted = readStorage(key);
  if (persisted) return Date.now() - persisted.writtenAt;
  return null;
}

export function writeCache<T>(key: string, data: T) {
  const entry: CacheEntry = { data, writtenAt: Date.now() };
  store.set(key, entry);
  writeStorage(key, entry);
  notify(key);
}

export function clearCache(key: string) {
  store.delete(key);
  removeStorage(key);
  notify(key);
}

export function clearAllCaches() {
  store.clear();
  if (typeof window !== "undefined") {
    try {
      Object.keys(sessionStorage)
        .filter((k) => k.startsWith(STORAGE_PREFIX))
        .forEach((k) => sessionStorage.removeItem(k));
    } catch {
      // ignore
    }
  }
  listeners.forEach((set) => set.forEach((fn) => fn()));
}
