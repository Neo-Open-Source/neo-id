"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, api } from "@/lib/api";
import { clearCache, getCacheAge, readCache, subscribeCache, writeCache, CACHE_PERSIST_TTL_MS } from "@/lib/cache";

interface UseCachedQueryOptions {
  enabled?: boolean;
  cacheKey?: string;
  /**
   * Skip fetch if cached data is fresher than this many ms.
   * Defaults to 0 (always revalidate on mount).
   * Set to CACHE_PERSIST_TTL_MS to fully rely on cache until it expires.
   */
  staleTime?: number;
}

interface UseCachedQueryResult<T> {
  data: T | null;
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<T | null>;
  mutate: (updater: T | ((current: T | null) => T | null)) => void;
}

export function useCachedQuery<T>(
  path: string,
  options: UseCachedQueryOptions = {},
): UseCachedQueryResult<T> {
  const { enabled = true, cacheKey = path, staleTime = 0 } = options;

  const cached = useSyncExternalStore(
    (onChange) => subscribeCache(cacheKey, onChange),
    () => readCache<T>(cacheKey),
    () => null,
  );

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!cached && enabled);
  const fetchingRef = useRef(false);
  // Use a ref object so the cleanup closure always sees the current value
  const mountedRef = useRef(true);

  const fetchData = useCallback(
    async (background = false): Promise<T | null> => {
      if (!enabled || fetchingRef.current) return null;
      fetchingRef.current = true;
      if (!background) setIsLoading(true);

      try {
        const fresh = await api<T>(path);
        if (!mountedRef.current) return fresh;
        writeCache(cacheKey, fresh);
        setError(null);
        return fresh;
      } catch (e) {
        if (!mountedRef.current) return null;
        if (!readCache(cacheKey)) {
          setError(e instanceof ApiError ? e.message : "Failed to load");
        }
        return null;
      } finally {
        fetchingRef.current = false;
        if (mountedRef.current) setIsLoading(false);
      }
    },
    [cacheKey, enabled, path],
  );

  useEffect(() => {
    // Reset on each mount (strict mode / remounts)
    mountedRef.current = true;

    if (!enabled) return;

    const age = getCacheAge(cacheKey) ?? Infinity;
    const effectiveStale = Math.max(staleTime, CACHE_PERSIST_TTL_MS);

    // If we have fresh-enough cached data, skip the network fetch entirely.
    // DashboardLayout already fetched /user/profile — ProfilePage reuses it.
    if (cached && age < effectiveStale) return;

    void fetchData();

    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cacheKey]);

  const refresh = useCallback(async () => {
    await fetchData(true);
    return readCache<T>(cacheKey);
  }, [fetchData, cacheKey]);

  const mutate = useCallback(
    (updater: T | ((current: T | null) => T | null)) => {
      const next = typeof updater === "function"
        ? (updater as (current: T | null) => T | null)(readCache<T>(cacheKey))
        : updater;
      if (next == null) clearCache(cacheKey);
      else writeCache(cacheKey, next);
    },
    [cacheKey],
  );

  return {
    data: cached,
    error,
    isLoading,
    refresh,
    mutate,
  };
}
