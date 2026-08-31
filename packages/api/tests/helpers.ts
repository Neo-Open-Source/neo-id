import { db } from "./__mocks__/db";

// ─── Test Helpers ────────────────────────────────────────────────────────────
/* eslint-disable @typescript-eslint/no-explicit-any */

export { db };

export async function cleanDb() {
  // Clear all stores
  for (const key of Object.keys(db)) {
    const model = db[key as keyof typeof db];
    if (model && typeof model === "object" && "_store" in model) {
      (model as any)._store.length = 0;
    }
  }
}

export async function createTestUser(data?: {
  email?: string;
  username?: string;
  password?: string;
  role?: string;
}) {
  const { hash } = await import("@neo-id/auth-core");
  const passwordHash = await hash(data?.password || "test1234");

  return db.user.create({
    data: {
      email: data?.email || `test-${Date.now()}@example.com`,
      username: data?.username || `testuser-${Date.now()}`,
      passwordHash,
      displayName: "Test User",
      role: data?.role || "user",
      emailVerified: true,
    },
  });
}

// ─── Request Helpers ─────────────────────────────────────────────────────────

export async function makeRequest(
  app: any,
  method: string,
  path: string,
  options?: {
    body?: unknown;
    headers?: Record<string, string>;
  }
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...options?.headers,
  };

  return app.request(path, {
    method,
    headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` };
}
