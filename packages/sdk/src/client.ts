import type { ApiResponse, User, Session, ServiceApp, Passkey } from "@neo-id/shared";
import { ApiError } from "@neo-id/shared";

export { ApiError } from "@neo-id/shared";

export interface NeoIdClientConfig {
  baseUrl: string;
  onError?: (error: ApiError) => void;
}

export class NeoIdClient {
  private baseUrl: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private onError?: (error: ApiError) => void;

  constructor(config: NeoIdClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.onError = config.onError;
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken;
    this.refreshToken = refreshToken;
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  getAccessToken() {
    return this.accessToken;
  }

  getRefreshToken() {
    return this.refreshToken;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    requireAuth = true
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken && requireAuth) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const json: ApiResponse<T> = await res.json();

    if (!json.ok && json.error) {
      this.onError?.(json.error);
    }

    return json;
  }

  private async upload<T>(
    path: string,
    formData: FormData
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {};

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: formData,
    });

    const json: ApiResponse<T> = await res.json();

    if (!json.ok && json.error) {
      this.onError?.(json.error);
    }

    return json;
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async register(data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) {
    return this.request<{ id: string; email: string; role: string; is_first_admin: boolean }>(
      "POST",
      "/api/v1/auth/register",
      { ...data, ageConfirmed: true },
      false
    );
  }

  async login(email: string, password: string) {
    return this.request<{
      mfa_required?: boolean;
      mfa_methods?: string[];
      passkey_available?: boolean;
      email_hint?: string;
      accessToken?: string;
      refreshToken?: string;
      idToken?: string;
      user?: Pick<User, "id" | "email" | "displayName" | "role">;
    }>("POST", "/api/v1/auth/login", { email, password }, false);
  }

  async refresh(refreshToken?: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      idToken: string;
    }>("POST", "/api/v1/auth/refresh", {
      refresh_token: refreshToken || this.refreshToken,
    }, false);
  }

  async logout() {
    const result = await this.request<{ ok: boolean }>("POST", "/api/v1/auth/logout");
    this.accessToken = null;
    this.refreshToken = null;
    return result;
  }

  async forgotPassword(email: string) {
    return this.request<{ sent: boolean }>(
      "POST",
      "/api/v1/auth/forgot-password",
      { email },
      false
    );
  }

  async resetPassword(token: string, newPassword: string) {
    return this.request<{ reset: boolean }>(
      "POST",
      "/api/v1/auth/reset-password",
      { token, newPassword },
      false
    );
  }

  // ─── User ──────────────────────────────────────────────────────────────────

  async getProfile() {
    return this.request<User>("GET", "/api/v1/user/profile");
  }

  async updateProfile(data: {
    displayName?: string;
    firstName?: string;
    lastName?: string;
  }) {
    return this.request<User>("PUT", "/api/v1/user/profile", data);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    return this.request<{ ok: boolean }>("PUT", "/api/v1/user/password", {
      currentPassword,
      newPassword,
    });
  }

  async uploadAvatar(file: File) {
    const formData = new FormData();
    formData.append("avatar", file);
    return this.upload<{ avatar: string }>("/api/v1/user/avatar", formData);
  }

  async deleteAccount(password?: string) {
    return this.request<{ ok: boolean }>("DELETE", "/api/v1/user", { password });
  }

  // ─── Sessions ──────────────────────────────────────────────────────────────

  async getSessions() {
    return this.request<Session[]>("GET", "/api/v1/sessions");
  }

  async revokeSession(id: string) {
    return this.request<{ ok: boolean }>("DELETE", `/api/v1/sessions/${id}`);
  }

  async revokeAllSessions() {
    return this.request<{ ok: boolean }>("DELETE", "/api/v1/sessions");
  }

  // ─── Connected Apps ────────────────────────────────────────────────────────

  async getConnections() {
    return this.request<Array<{ id: string; serviceApp: { name: string; logoUrl?: string } }>>(
      "GET",
      "/api/v1/user/connections"
    );
  }

  async disconnectIdentity(provider: string) {
    return this.request<{ ok: boolean }>("DELETE", `/api/v1/user/identities/${provider}`);
  }

  // ─── Passkeys ──────────────────────────────────────────────────────────────

  async getPasskeys() {
    return this.request<Passkey[]>("GET", "/api/v1/passkeys");
  }

  async deletePasskey(id: string) {
    return this.request<{ ok: boolean }>("DELETE", `/api/v1/passkeys/${id}`);
  }

  async startPasskeyRegistration() {
    return this.request<Record<string, unknown>>("POST", "/api/v1/passkeys/register/start");
  }

  async finishPasskeyRegistration(response: Record<string, unknown>, expectedChallenge: string, deviceName?: string) {
    return this.request<{ id: string; credentialId: string }>(
      "POST",
      "/api/v1/passkeys/register/finish",
      { response, expectedChallenge, deviceName }
    );
  }

  // ─── MFA ───────────────────────────────────────────────────────────────────

  async setupTotp() {
    return this.request<{ secret: string; uri: string; qr_code_url: string }>(
      "POST",
      "/api/v1/mfa/totp/setup"
    );
  }

  async enableTotp(code: string) {
    return this.request<{ ok: boolean }>("POST", "/api/v1/mfa/totp/enable", { code });
  }

  async disableTotp() {
    return this.request<{ ok: boolean }>("POST", "/api/v1/mfa/totp/disable");
  }

  async setupEmailMfa() {
    return this.request<{ email_hint: string }>("POST", "/api/v1/mfa/email/setup");
  }

  async enableEmailMfa(code: string) {
    return this.request<{ ok: boolean }>("POST", "/api/v1/mfa/email/enable", { code });
  }

  async disableEmailMfa() {
    return this.request<{ ok: boolean }>("POST", "/api/v1/mfa/email/disable");
  }

  async verifyMfa(email: string, method: string, code: string, purpose?: string) {
    return this.request<{ accessToken?: string; user?: Record<string, unknown> }>(
      "POST",
      "/api/v1/mfa/verify",
      { email, method, code, purpose },
      false
    );
  }

  // ─── Services (Developer Portal) ───────────────────────────────────────────

  async getServices() {
    return this.request<ServiceApp[]>("GET", "/api/v1/services");
  }

  async createService(data: {
    name: string;
    displayName?: string;
    description?: string;
    website?: string;
    redirectUris: string[];
  }) {
    return this.request<ServiceApp & { client_secret: string }>(
      "POST",
      "/api/v1/services",
      data
    );
  }

  async getService(id: string) {
    return this.request<ServiceApp>("GET", `/api/v1/services/${id}`);
  }

  async updateService(id: string, data: Partial<Pick<ServiceApp, "displayName" | "description" | "website" | "redirectUris">>) {
    return this.request<ServiceApp>("PUT", `/api/v1/services/${id}`, data);
  }

  async deleteService(id: string) {
    return this.request<{ ok: boolean }>("DELETE", `/api/v1/services/${id}`);
  }

  async rotateServiceSecret(id: string) {
    return this.request<{ client_secret: string }>(
      "POST",
      `/api/v1/services/${id}/rotate-secret`
    );
  }

  async uploadServiceLogo(id: string, file: File) {
    const formData = new FormData();
    formData.append("logo", file);
    return this.upload<{ url: string }>(`/api/v1/services/${id}/logo`, formData);
  }

  // ─── Admin ─────────────────────────────────────────────────────────────────

  async adminListUsers(params?: { page?: number; limit?: number; search?: string }) {
    const query = new URLSearchParams();
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);

    return this.request<{
      users: User[];
      pagination: { page: number; limit: number; total: number; pages: number };
    }>("GET", `/api/v1/admin/users?${query.toString()}`);
  }

  async adminGetUser(id: string) {
    return this.request<User>("GET", `/api/v1/admin/users/${id}`);
  }

  async adminBanUser(id: string, banned: boolean, reason?: string) {
    return this.request<{ ok: boolean }>("POST", `/api/v1/admin/users/${id}/ban`, {
      banned,
      reason,
    });
  }

  async adminSetRole(id: string, role: string) {
    return this.request<{ ok: boolean }>("POST", `/api/v1/admin/users/${id}/role`, {
      role,
    });
  }

  async adminResetPassword(id: string) {
    return this.request<{ newPassword: string }>(
      "POST",
      `/api/v1/admin/users/${id}/reset-password`
    );
  }

  async adminDeleteUser(id: string) {
    return this.request<{ ok: boolean }>("DELETE", `/api/v1/admin/users/${id}`);
  }

  async adminGetStats() {
    return this.request<{
      totalUsers: number;
      activeUsers: number;
      mfaEnabled: number;
      oauthConnected: number;
      totalServices: number;
      recentLogins: number;
    }>("GET", "/api/v1/admin/stats");
  }

  async adminGetServices() {
    return this.request<Array<{
      id: string;
      clientId: string;
      name: string;
      displayName?: string;
      isActive: boolean;
      owner: { id: string; email: string };
      connectionCount: number;
    }>>("GET", "/api/v1/admin/services");
  }
}
