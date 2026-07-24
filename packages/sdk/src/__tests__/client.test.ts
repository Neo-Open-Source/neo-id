import { describe, it, expect, beforeEach, vi } from "vitest";
import { NeoIdClient } from "../client";

// Mock fetch
/* eslint-disable @typescript-eslint/no-explicit-any */
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

function mockResponse(data: any, ok = true) {
  return {
    ok,
    json: async () => ({ ok, data, error: ok ? undefined : data }),
  };
}

describe("NeoIdClient", () => {
  let client: NeoIdClient;

  beforeEach(() => {
    mockFetch.mockReset();
    client = new NeoIdClient({ baseUrl: "http://localhost:3000" });
  });

  describe("constructor", () => {
    it("should set baseUrl", () => {
      expect(client.getAccessToken()).toBeNull();
      expect(client.getRefreshToken()).toBeNull();
    });

    it("should strip trailing slash from baseUrl", () => {
      const c = new NeoIdClient({ baseUrl: "http://localhost:3000/" });
      mockFetch.mockResolvedValue(mockResponse({ id: "1" }));
      // The internal baseUrl should not have trailing slash
      expect(c).toBeDefined();
    });
  });

  describe("token management", () => {
    it("should set and get tokens", () => {
      client.setTokens("access123", "refresh456");
      expect(client.getAccessToken()).toBe("access123");
      expect(client.getRefreshToken()).toBe("refresh456");
    });

    it("should set access token", () => {
      client.setAccessToken("token123");
      expect(client.getAccessToken()).toBe("token123");
    });

    it("should clear tokens on logout", async () => {
      client.setTokens("access", "refresh");
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));
      await client.logout();
      expect(client.getAccessToken()).toBeNull();
      expect(client.getRefreshToken()).toBeNull();
    });
  });

  describe("auth methods", () => {
    it("should register a user", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: "user1",
        email: "test@example.com",
        role: "user",
      }));

      const result = await client.register({
        email: "test@example.com",
        username: "testuser",
        password: "password123",
      });

      expect(result.ok).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/auth/register",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            email: "test@example.com",
            username: "testuser",
            password: "password123",
            ageConfirmed: true,
          }),
        })
      );
    });

    it("should login", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        accessToken: "access123",
        refreshToken: "refresh123",
        user: { id: "1", email: "test@example.com", role: "user" },
      }));

      const result = await client.login("test@example.com", "password123");

      expect(result.ok).toBe(true);
      expect(result.data?.accessToken).toBe("access123");
    });

    it("should return MFA required when login needs MFA", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        mfa_required: true,
        mfa_methods: ["totp", "email"],
      }));

      const result = await client.login("test@example.com", "password123");

      expect(result.ok).toBe(true);
      expect(result.data?.mfa_required).toBe(true);
      expect(result.data?.mfa_methods).toEqual(["totp", "email"]);
    });

    it("should refresh tokens", async () => {
      client.setTokens("old_access", "old_refresh");
      mockFetch.mockResolvedValue(mockResponse({
        accessToken: "new_access",
        refreshToken: "new_refresh",
        idToken: "id_token",
      }));

      const result = await client.refresh();

      expect(result.ok).toBe(true);
      expect(result.data?.accessToken).toBe("new_access");
    });

    it("should logout and clear tokens", async () => {
      client.setTokens("access", "refresh");
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      await client.logout();

      expect(client.getAccessToken()).toBeNull();
      expect(client.getRefreshToken()).toBeNull();
    });
  });

  describe("forgot password", () => {
    it("should request password reset", async () => {
      mockFetch.mockResolvedValue(mockResponse({ sent: true }));

      const result = await client.forgotPassword("test@example.com");

      expect(result.ok).toBe(true);
      expect(result.data?.sent).toBe(true);
    });

    it("should reset password", async () => {
      mockFetch.mockResolvedValue(mockResponse({ reset: true }));

      const result = await client.resetPassword("token123", "newpassword");

      expect(result.ok).toBe(true);
      expect(result.data?.reset).toBe(true);
    });
  });

  describe("user methods", () => {
    beforeEach(() => {
      client.setAccessToken("access_token");
    });

    it("should get profile", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: "1",
        email: "test@example.com",
        role: "user",
      }));

      const result = await client.getProfile();

      expect(result.ok).toBe(true);
      expect(result.data?.email).toBe("test@example.com");
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/user/profile",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer access_token",
          }),
        })
      );
    });

    it("should update profile", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: "1",
        displayName: "New Name",
      }));

      const result = await client.updateProfile({ displayName: "New Name" });

      expect(result.ok).toBe(true);
    });

    it("should change password", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.changePassword("old123", "new123");

      expect(result.ok).toBe(true);
    });
  });

  describe("session methods", () => {
    beforeEach(() => {
      client.setAccessToken("access_token");
    });

    it("should get sessions", async () => {
      mockFetch.mockResolvedValue(mockResponse([
        { id: "s1", deviceInfo: "Chrome", isActive: true },
      ]));

      const result = await client.getSessions();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("should revoke a session", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.revokeSession("s1");

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/sessions/s1",
        expect.objectContaining({ method: "DELETE" })
      );
    });
  });

  describe("passkey methods", () => {
    beforeEach(() => {
      client.setAccessToken("access_token");
    });

    it("should get passkeys", async () => {
      mockFetch.mockResolvedValue(mockResponse([
        { id: "p1", credentialId: "cred1", deviceName: "MacBook" },
      ]));

      const result = await client.getPasskeys();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("should delete a passkey", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.deletePasskey("p1");

      expect(result.ok).toBe(true);
    });

    it("should start passkey registration", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        challenge: "abc123",
        rp: { name: "Neo ID" },
      }));

      const result = await client.startPasskeyRegistration();

      expect(result.ok).toBe(true);
      expect(result.data?.challenge).toBe("abc123");
    });
  });

  describe("MFA methods", () => {
    beforeEach(() => {
      client.setAccessToken("access_token");
    });

    it("should setup TOTP", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        secret: "JBSWY3DPEHPK3PXP",
        uri: "otpauth://totp/Neo ID:test@example.com",
        qr_code_url: "https://api.qrserver.com/...",
      }));

      const result = await client.setupTotp();

      expect(result.ok).toBe(true);
      expect(result.data?.secret).toBeDefined();
    });

    it("should enable TOTP with code", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.enableTotp("123456");

      expect(result.ok).toBe(true);
    });

    it("should disable TOTP without code", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.disableTotp();

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/mfa/totp/disable",
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("should disable email MFA without code", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.disableEmailMfa();

      expect(result.ok).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        "http://localhost:3000/api/v1/mfa/email/disable",
        expect.objectContaining({
          method: "POST",
        })
      );
    });
  });

  describe("service methods", () => {
    beforeEach(() => {
      client.setAccessToken("access_token");
    });

    it("should get services", async () => {
      mockFetch.mockResolvedValue(mockResponse([
        { id: "s1", name: "my-app", clientId: "client1" },
      ]));

      const result = await client.getServices();

      expect(result.ok).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it("should create a service", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        id: "s1",
        name: "my-app",
        clientId: "client1",
        client_secret: "secret123",
      }));

      const result = await client.createService({
        name: "my-app",
        redirectUris: ["https://example.com/callback"],
      });

      expect(result.ok).toBe(true);
      expect(result.data?.client_secret).toBe("secret123");
    });

    it("should delete a service", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.deleteService("s1");

      expect(result.ok).toBe(true);
    });

    it("should rotate service secret", async () => {
      mockFetch.mockResolvedValue(mockResponse({ client_secret: "new_secret" }));

      const result = await client.rotateServiceSecret("s1");

      expect(result.ok).toBe(true);
      expect(result.data?.client_secret).toBe("new_secret");
    });
  });

  describe("admin methods", () => {
    beforeEach(() => {
      client.setAccessToken("admin_token");
    });

    it("should list users", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        users: [{ id: "1", email: "test@example.com" }],
        pagination: { page: 1, limit: 20, total: 1, pages: 1 },
      }));

      const result = await client.adminListUsers();

      expect(result.ok).toBe(true);
      expect(result.data?.users).toHaveLength(1);
    });

    it("should ban a user", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.adminBanUser("user1", true, "spam");

      expect(result.ok).toBe(true);
    });

    it("should set user role", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.adminSetRole("user1", "admin");

      expect(result.ok).toBe(true);
    });

    it("should get stats", async () => {
      mockFetch.mockResolvedValue(mockResponse({
        totalUsers: 100,
        activeUsers: 80,
        mfaEnabled: 50,
        oauthConnected: 30,
        totalServices: 10,
        recentLogins: 20,
      }));

      const result = await client.adminGetStats();

      expect(result.ok).toBe(true);
      expect(result.data?.totalUsers).toBe(100);
    });

    it("should reset user password", async () => {
      mockFetch.mockResolvedValue(mockResponse({ newPassword: "newpass123" }));

      const result = await client.adminResetPassword("user1");

      expect(result.ok).toBe(true);
      expect(result.data?.newPassword).toBe("newpass123");
    });

    it("should delete user", async () => {
      mockFetch.mockResolvedValue(mockResponse({ ok: true }));

      const result = await client.adminDeleteUser("user1");

      expect(result.ok).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should call onError callback", async () => {
      const onError = vi.fn();
      const clientWithErrorHandler = new NeoIdClient({
        baseUrl: "http://localhost:3000",
        onError,
      });

      mockFetch.mockResolvedValue(mockResponse(
        { code: "INVALID_CREDENTIALS", message: "Bad credentials" },
        false
      ));

      await clientWithErrorHandler.login("test@example.com", "wrong");

      expect(onError).toHaveBeenCalledWith({
        code: "INVALID_CREDENTIALS",
        message: "Bad credentials",
      });
    });

    it("should handle network errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network error"));

      await expect(client.getProfile()).rejects.toThrow("Network error");
    });
  });
});
