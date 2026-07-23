import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb, makeRequest, createTestUser, authHeader } from "../helpers";

describe("POST /api/v1/auth/logout", () => {
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

  it("should logout successfully", async () => {
    const loginRes = await makeRequest(app, "POST", "/api/v1/auth/login", {
      body: { email: "test@example.com", password: "password123" },
    });
    const loginJson = await loginRes.json();
    const accessToken = loginJson.data.accessToken;

    const res = await makeRequest(app, "POST", "/api/v1/auth/logout", {
      headers: authHeader(accessToken),
    });

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
  });
});
