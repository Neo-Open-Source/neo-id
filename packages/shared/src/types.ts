// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole = "user" | "developer" | "admin";
export type UserStatus = "active" | "banned" | "invited";

export interface User {
  id: string;
  email: string;
  emailVerified: boolean;
  username?: string;
  displayName?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  role: UserRole;
  status: UserStatus;
  userMetadata?: UserMetadata;
  appMetadata?: AppMetadata;
  totpEnabled: boolean;
  emailMfaEnabled: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
}

// ─── Metadata Type Guards (Prisma returns JsonValue = any) ────────────────────

export interface UserMetadata {
  [key: string]: unknown;
}

export interface AppMetadata {
  roles?: string[];
  plan?: string;
  [key: string]: unknown;
}

export function isUserMetadata(value: unknown): value is UserMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isAppMetadata(value: unknown): value is AppMetadata {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function safeUserMetadata(value: unknown): UserMetadata {
  if (isUserMetadata(value)) return value;
  return {};
}

export function safeAppMetadata(value: unknown): AppMetadata {
  if (isAppMetadata(value)) return value;
  return {};
}

// ─── Session ─────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  userId: string;
  deviceInfo?: string;
  ipAddress?: string;
  location?: string;
  isActive: boolean;
  createdAt: string;
  lastActiveAt: string;
  expiresAt?: string;
}

// ─── Service App ─────────────────────────────────────────────────────────────

export interface ServiceApp {
  id: string;
  ownerId: string;
  clientId: string;
  name: string;
  displayName?: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  redirectUris: string[];
  allowedScopes: string[];
  grantTypes: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Passkey ─────────────────────────────────────────────────────────────────

export interface Passkey {
  id: string;
  credentialId: string;
  deviceName?: string;
  createdAt: string;
  lastUsedAt?: string;
}

// ─── Identity (OAuth provider link) ──────────────────────────────────────────

export interface Identity {
  provider: string;
  providerUserId: string;
  createdAt: string;
}

// ─── MFA ─────────────────────────────────────────────────────────────────────

export type MfaMethod = "passkey" | "totp" | "email";

export interface MfaRequiredResponse {
  mfa_required: true;
  mfa_methods: MfaMethod[];
  passkey_available: boolean;
  email_hint?: string;
}

export interface TotpSetupResponse {
  secret: string;
  uri: string;
  qr_code_url: string;
}

// ─── API Response ────────────────────────────────────────────────────────────

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ApiError;
  meta: ResponseMeta;
}

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number = 500,
    public details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ApiError";
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      status: this.status,
      name: this.name,
      ...(this.details ? { details: this.details } : {}),
    };
  }
}

export interface ResponseMeta {
  request_id: string;
  timestamp: string;
}

// ─── Error Codes ─────────────────────────────────────────────────────────────

export type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "MFA_REQUIRED"
  | "MFA_INVALID_CODE"
  | "MFA_NOT_ENABLED"
  | "MFA_ALREADY_ENABLED"
  | "PASSKEY_NOT_FOUND"
  | "TOKEN_EXPIRED"
  | "TOKEN_INVALID"
  | "USER_NOT_FOUND"
  | "USER_BANNED"
  | "EMAIL_ALREADY_EXISTS"
  | "USERNAME_TAKEN"
  | "PASSWORD_TOO_WEAK"
  | "RATE_LIMITED"
  | "INVALID_REQUEST"
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_ERROR"
  | "SERVICE_UNAVAILABLE"
  | "EMAIL_FAILED"
  | "CODE_REQUIRED";

// ─── Pagination ──────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

// ─── Admin ───────────────────────────────────────────────────────────────────

export interface AdminUser extends User {
  lastLoginIp?: string;
  identities: Identity[];
  passkeyCount: number;
  sessionCount: number;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  mfaEnabled: number;
  oauthConnected: number;
  totalServices: number;
  recentLogins: number;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetId?: string;
  targetEmail?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  createdAt: string;
}
