import type { ApiResponse, User, Session, ServiceApp } from "@neo-id/shared";

export interface NeoIdClientConfig {
  baseUrl: string;
}

export class NeoIdClient {
  private baseUrl: string;
  private accessToken: string | null = null;

  constructor(config: NeoIdClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
  }

  setAccessToken(token: string | null) {
    this.accessToken = token;
  }

  private async request<T>(
    method: string,
    path: string,
    body?: unknown
  ): Promise<ApiResponse<T>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (this.accessToken) {
      headers["Authorization"] = `Bearer ${this.accessToken}`;
    }

    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    return res.json();
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async register(data: {
    email: string;
    username: string;
    password: string;
    displayName?: string;
  }) {
    return this.request<{ id: string; email: string }>(
      "POST",
      "/api/v1/auth/register",
      { ...data, ageConfirmed: true }
    );
  }

  async login(email: string, password: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      idToken: string;
      user: Pick<User, "id" | "email" | "displayName" | "role">;
    }>("POST", "/api/v1/auth/login", { email, password });
  }

  async refresh(refreshToken: string) {
    return this.request<{
      accessToken: string;
      refreshToken: string;
      idToken: string;
    }>("POST", "/api/v1/auth/refresh", { refresh_token: refreshToken });
  }

  async logout() {
    return this.request<{ ok: boolean }>("POST", "/api/v1/auth/logout");
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

  // ─── Services ──────────────────────────────────────────────────────────────

  async getServices() {
    return this.request<ServiceApp[]>("GET", "/api/v1/services");
  }

  async createService(data: {
    name: string;
    displayName?: string;
    description?: string;
    redirectUris: string[];
  }) {
    return this.request<ServiceApp & { token: string }>(
      "POST",
      "/api/v1/services",
      data
    );
  }

  async getService(id: string) {
    return this.request<ServiceApp>("GET", `/api/v1/services/${id}`);
  }

  async updateService(id: string, data: Partial<ServiceApp>) {
    return this.request<ServiceApp>("PUT", `/api/v1/services/${id}`, data);
  }

  async deleteService(id: string) {
    return this.request<{ ok: boolean }>("DELETE", `/api/v1/services/${id}`);
  }

  async rotateServiceSecret(id: string) {
    return this.request<{ token: string }>(
      "POST",
      `/api/v1/services/${id}/rotate-secret`
    );
  }
}
