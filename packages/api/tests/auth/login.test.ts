import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb, makeRequest, createTestUser } from "../helpers";
/* eslint-disable @typescript-eslint/no-explicit-any */

describe("POST /api/v1/auth/login", () => {
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

  it("should login with valid credentials", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/login", {
      body: {
        email: "test@example.com",
        password: "password123",
      },
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.data.accessToken).toBeDefined();
    expect(json.data.refreshToken).toBeDefined();
  });

  it("should return error for invalid credentials", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/login", {
      body: {
        email: "test@example.com",
        password: "wrongpassword",
      },
    });

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("should return error for non-existent user", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/login", {
      body: {
        email: "nonexistent@example.com",
        password: "password123",
      },
    });

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_CREDENTIALS");
  });
});
