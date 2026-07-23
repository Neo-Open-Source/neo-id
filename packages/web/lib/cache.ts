const store = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function subscribeCache(key: string, listener: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(listener);
  return () => {
    listeners.get(key)?.delete(listener);
  };
}

export function readCache<T>(key: string): T | null {
  return (store.get(key) as T) ?? null;
}

export function writeCache<T>(key: string, data: T) {
  store.set(key, data);
  notify(key);
}

export function clearCache(key: string) {
  store.delete(key);
  notify(key);
}

export function clearAllCaches() {
  store.clear();
  listeners.forEach((set) => set.forEach((fn) => fn()));
}
