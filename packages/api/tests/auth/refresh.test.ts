import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb, makeRequest, createTestUser } from "../helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("POST /api/v1/auth/refresh", () => {
  let app: any;

  beforeEach(async () => {
    await cleanDb();
    const mod = await import("../../src/index");
    app = mod.default || mod;

    await createTestUser({
      email: "test@example.com",
      password: "password123",
    });
  });

  it("should refresh tokens", async () => {
    const loginRes = await makeRequest(app, "POST", "/api/v1/auth/login", {
      body: { email: "test@example.com", password: "password123" },
    });
    const loginJson = await loginRes.json();
    const refreshToken = loginJson.data.refreshToken;

    const res = await makeRequest(app, "POST", "/api/v1/auth/refresh", {
      body: { refresh_token: refreshToken },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.refreshToken).not.toBe(refreshToken);
  });

  it("should return error for invalid refresh token", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/refresh", {
      body: { refresh_token: "invalid-token" },
    });

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("TOKEN_INVALID");
  });

  it("should allow reuse of a just-rotated refresh token within grace window", async () => {
    const loginRes = await makeRequest(app, "POST", "/api/v1/auth/login", {
      body: { email: "test@example.com", password: "password123" },
    });
    const loginJson = await loginRes.json();
    const refreshToken = loginJson.data.refreshToken as string;

    const first = await makeRequest(app, "POST", "/api/v1/auth/refresh", {
      body: { refresh_token: refreshToken },
    });
    expect(first.status).toBe(200);
    const firstJson = await first.json();
    expect(firstJson.ok).toBe(true);

    // Concurrent tab / laggy Set-Cookie re-sends the previous token
    const second = await makeRequest(app, "POST", "/api/v1/auth/refresh", {
      body: { refresh_token: refreshToken },
    });
    expect(second.status).toBe(200);
    const secondJson = await second.json();
    expect(secondJson.ok).toBe(true);
    expect(secondJson.data.accessToken).toBeDefined();
    expect(secondJson.data.refreshToken).toBeDefined();
  });
});
