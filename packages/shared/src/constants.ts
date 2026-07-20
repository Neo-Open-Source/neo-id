// ─── OAuth Scopes ────────────────────────────────────────────────────────────

export const SCOPES = {
  OPENID: "openid",
  PROFILE: "profile",
  EMAIL: "email",
} as const;

export const DEFAULT_SCOPES = [SCOPES.OPENID, SCOPES.PROFILE, SCOPES.EMAIL];

// ─── Token Config ────────────────────────────────────────────────────────────

export const TOKEN = {
  ACCESS_TOKEN_EXPIRY: 15 * 60, // 15 minutes in seconds
  REFRESH_TOKEN_EXPIRY: 30 * 24 * 60 * 60, // 30 days in seconds
  ID_TOKEN_EXPIRY: 60 * 60, // 1 hour in seconds
  REFRESH_TOKEN_LENGTH: 64, // bytes
  REUSE_DETECTION_WINDOW: 10, // seconds
} as const;

// ─── Rate Limits ─────────────────────────────────────────────────────────────

export const RATE_LIMITS = {
  LOGIN: { limit: 10, window: 60 },
  REGISTER: { limit: 5, window: 60 },
  MFA: { limit: 5, window: 60 },
  REFRESH: { limit: 30, window: 60 },
  GENERAL: { limit: 100, window: 60 },
  PASSWORD_RESET: { limit: 3, window: 600 },
  EMAIL_VERIFY: { limit: 3, window: 600 },
} as const;

// ─── Password Rules (NIST 800-63B) ──────────────────────────────────────────

export const PASSWORD = {
  MIN_LENGTH: 8,
  MAX_LENGTH: 128,
} as const;

// ─── User Rules ──────────────────────────────────────────────────────────────

export const USER = {
  USERNAME_MIN: 3,
  USERNAME_MAX: 30,
  USERNAME_REGEX: /^[a-zA-Z0-9_-]+$/,
  DISPLAY_NAME_MAX: 100,
  AVATAR_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  AVATAR_ALLOWED_TYPES: ["image/png", "image/jpeg", "image/webp"],
} as const;

// ─── Email ───────────────────────────────────────────────────────────────────

export const EMAIL = {
  CODE_LENGTH: 6,
  CODE_EXPIRY: 10 * 60, // 10 minutes
  RESEND_COOLDOWN: 60, // 60 seconds
} as const;

// ─── Session ─────────────────────────────────────────────────────────────────

export const SESSION = {
  MAX_PER_USER: 10,
  INACTIVITY_TIMEOUT: 30 * 24 * 60 * 60, // 30 days
} as const;

// ─── OAuth Providers ─────────────────────────────────────────────────────────

export const OAUTH_PROVIDERS = ["google", "github"] as const;

export type OAuthProvider = (typeof OAUTH_PROVIDERS)[number];

// ─── Roles ───────────────────────────────────────────────────────────────────

export const ROLES = ["user", "developer", "admin"] as const;

// ─── Audit Actions ───────────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  USER_BAN: "user.ban",
  USER_UNBAN: "user.unban",
  USER_ROLE_CHANGE: "user.role_change",
  USER_DELETE: "user.delete",
  SERVICE_CREATE: "service.create",
  SERVICE_UPDATE: "service.update",
  SERVICE_DELETE: "service.delete",
  SERVICE_ROTATE_SECRET: "service.rotate_secret",
} as const;
