export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  PROFILE: '/profile',
  SECURITY: '/security',
  SESSIONS: '/sessions',
  SERVICES: '/services',
  DEVELOPER: '/developer',
  ADMIN: '/admin',
  VERIFY: '/verify',
  SETUP: '/setup',
  CONSENT: '/consent',
  TERMS: '/terms',
  PRIVACY: '/privacy',
  DOCS: '/docs',
} as const

export const OAUTH_PROVIDERS = {
  GOOGLE: 'google',
  GITHUB: 'github',
  YANDEX: 'yandex',
  VK: 'vk',
} as const

export const TOKEN_STORAGE_KEYS = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
} as const

export const SESSION_STORAGE_KEYS = {
  MFA_EMAIL: 'mfa_email',
  MFA_VERIFY_TYPE: 'mfa_verify_type',
  MFA_OIDC: 'mfa_oidc',
  MFA_CLIENT_ID: 'mfa_client_id',
  MFA_REDIRECT_URI: 'mfa_redirect_uri',
  MFA_STATE: 'mfa_state',
  MFA_SCOPE: 'mfa_scope',
  MFA_MODE: 'mfa_mode',
  MFA_SITE_ID: 'mfa_site_id',
  MFA_REDIRECT_URL: 'mfa_redirect_url',
  MFA_SITE_STATE: 'mfa_site_state',
} as const

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
} as const
