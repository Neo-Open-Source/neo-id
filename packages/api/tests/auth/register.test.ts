import { describe, it, expect, beforeEach } from "vitest";
import { cleanDb, makeRequest } from "../helpers";

/* eslint-disable @typescript-eslint/no-explicit-any */

describe("POST /api/v1/auth/register", () => {
  let app: any;

  beforeEach(async () => {
    await cleanDb();
    const mod = await import("../../src/index");
    app = mod.default || mod;
  });

  it("should register a new user", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/register", {
      body: {
        email: "test@example.com",
        username: "testuser",
        password: "password123",
        ageConfirmed: true,
      },
    });

    const json = await res.json();

    expect(res.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.data.email).toBe("test@example.com");
    expect(json.data.role).toBeDefined();
  });

  it("should return error for duplicate email", async () => {
    await makeRequest(app, "POST", "/api/v1/auth/register", {
      body: {
        email: "test@example.com",
        username: "user1",
        password: "password123",
        ageConfirmed: true,
      },
    });

    const res = await makeRequest(app, "POST", "/api/v1/auth/register", {
      body: {
        email: "test@example.com",
        username: "user2",
        password: "password123",
        ageConfirmed: true,
      },
    });

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("should return error for invalid email", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/register", {
      body: {
        email: "not-an-email",
        username: "testuser",
        password: "password123",
        ageConfirmed: true,
      },
    });

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_REQUEST");
  });

  it("should return error for short password", async () => {
    const res = await makeRequest(app, "POST", "/api/v1/auth/register", {
      body: {
        email: "test@example.com",
        username: "testuser",
        password: "123",
        ageConfirmed: true,
      },
    });

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error.code).toBe("INVALID_REQUEST");
  });
});
