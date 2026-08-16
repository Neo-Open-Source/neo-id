"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { ApiError, api } from "@/lib/api";
import { clearCache, getCacheAge, readCache, subscribeCache, writeCache, CACHE_PERSIST_TTL_MS } from "@/lib/cache";

interface UseCachedQueryOptions {
  enabled?: boolean;
  cacheKey?: string;
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
  const { enabled = true, cacheKey = path } = options;

  const cached = useSyncExternalStore(
    (onChange) => subscribeCache(cacheKey, onChange),
    () => readCache<T>(cacheKey),
    () => null,
  );

  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(!cached && enabled);
  const fetchingRef = useRef(false);
  const disposedRef = useRef(false);

  const fetchData = useCallback(
    async (background = false): Promise<T | null> => {
      if (!enabled || fetchingRef.current) return null;
      fetchingRef.current = true;
      if (!background) setIsLoading(true);

      try {
        const fresh = await api<T>(path);
        if (disposedRef.current) return fresh;
        writeCache(cacheKey, fresh);
        setError(null);
        return fresh;
      } catch (e) {
        if (disposedRef.current) return null;
        if (!readCache(cacheKey)) {
          setError(e instanceof ApiError ? e.message : "Failed to load");
        }
        return null;
      } finally {
        fetchingRef.current = false;
        if (!disposedRef.current) setIsLoading(false);
      }
    },
    [cacheKey, enabled, path],
  );

  useEffect(() => {
    if (!enabled) return;
    // Paint cached data immediately on reload (persisted in sessionStorage),
    // but revalidate in the background once the copy is older than the TTL.
    if (!cached || (getCacheAge(cacheKey) ?? 0) > CACHE_PERSIST_TTL_MS) {
      void fetchData();
    }
    return () => {
      disposedRef.current = true;
    };
    // Only run on mount / when enabled flips
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
