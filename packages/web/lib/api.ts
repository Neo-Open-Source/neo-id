import { clearAllCaches } from "@/lib/cache";
import { ApiError } from "@neo-id/shared";

export { ApiError } from "@neo-id/shared";

const API_BASE = "/api/v1";

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: boolean;
}

let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;
let pendingRefreshToken: string | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

async function refreshSession(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    // Retry refresh up to 3 times with backoff — handles brief server restarts
    // where the API is momentarily unavailable when the browser first reconnects.
    const MAX_ATTEMPTS = 3;
    const BACKOFF_MS = [0, 800, 1500];

    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt]));
      }
      try {
        const body: Record<string, string> = {};
        if (pendingRefreshToken) {
          body.refresh_token = pendingRefreshToken;
        }
        const res = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: Object.keys(body).length ? JSON.stringify(body) : undefined,
        });
        const json = await res.json();
        if (json.ok && json.data?.accessToken) {
          accessToken = json.data.accessToken;
          if (json.data.refreshToken) {
            pendingRefreshToken = json.data.refreshToken;
          }
          return json.data.accessToken;
        }
        // Token genuinely invalid (not a network/server error) — stop retrying
        if (res.status === 400 || res.status === 401) {
          pendingRefreshToken = null;
          return null;
        }
        // Server error (5xx) or network issue — retry
      } catch {
        // Network error — retry
      }
    }

    pendingRefreshToken = null;
    return null;
  })();
  try {
    return await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function logoutSession(): Promise<void> {
  accessToken = null;
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // ignore
  }
  clearAllCaches();
}

async function fetchWithRetry<T>(path: string, init: RequestInit, token: boolean): Promise<T> {
  const headers = new Headers(init.headers);
  if (token && accessToken) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  const res = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init, headers });
  const json = await res.json();

  if (
    token &&
    (json.error?.code === "TOKEN_INVALID" || json.error?.code === "UNAUTHORIZED")
  ) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const newToken = await refreshSession();
      if (newToken) {
        headers.set("Authorization", `Bearer ${newToken}`);
        const retryRes = await fetch(`${API_BASE}${path}`, { credentials: "include", ...init, headers });
        const retryJson = await retryRes.json();
        if (retryJson.ok) return retryJson.data;
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }
    await logoutSession();
    window.location.href = "/auth";
    throw new ApiError("TOKEN_EXPIRED", "Session expired", 401);
  }

  if (!json.ok) {
    throw new ApiError(
      json.error?.code || "UNKNOWN",
      json.error?.message || "Request failed",
      res.status,
      json.error?.details,
    );
  }

  if (json.data?.accessToken) {
    accessToken = json.data.accessToken;
  }

  return json.data;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function api<T = any>(
  path: string,
  options: ApiOptions = {},
): Promise<T> {
  const { method = "GET", body, token = true } = options;

  const headers: Record<string, string> = {};
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  return fetchWithRetry<T>(path, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined }, token);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function apiUpload<T = any>(
  path: string,
  formData: FormData,
): Promise<T> {
  return fetchWithRetry<T>(path, { method: "POST", body: formData }, true);
}

export async function hasSession(): Promise<boolean> {
  if (accessToken) return true;

  // Auth cookies are httpOnly, so they are invisible to document.cookie.
  // Probe refresh with credentials instead.
  try {
    return (await refreshSession()) !== null;
  } catch {
    return false;
  }
}
