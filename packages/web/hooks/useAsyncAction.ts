"use client";

import { useCallback, useRef, useState } from "react";
import { ApiError } from "@/lib/api";

interface UseAsyncActionResult {
  execute: () => Promise<boolean>;
  loading: boolean;
  error: string | null;
  setError: (error: string | null) => void;
  reset: () => void;
}

export function useAsyncAction(
  fn: () => Promise<unknown>,
): UseAsyncActionResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const execute = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      await fnRef.current();
      setLoading(false);
      return true;
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "An error occurred";
      setError(msg);
      setLoading(false);
      return false;
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setLoading(false);
  }, []);

  return { execute, loading, error, setError, reset };
}
