export interface User {
  id: string
  email: string
  display_name: string
  avatar?: string
  created_at: string
  email_verified: boolean
}

export interface Session {
  id: string
  device: string
  ip: string
  location: string
  last_active: string
  current?: boolean
}

export interface Site {
  id: string
  name: string
  domain: string
  redirect_uris: string[]
  created_at: string
}

export interface Service {
  id: string
  name: string
  description?: string
  created_at: string
}

export interface ABExperiment {
  name: string
  variants: ABVariant[]
  active: boolean
}

export interface ABVariant {
  name: string
  weight: number
}

export interface AuthTokens {
  access_token: string
  refresh_token: string
}

export interface LoginResponse extends AuthTokens {
  user: User
  totp_required?: boolean
  mfa_required?: boolean
}

export interface ApiError {
  error: string
  details?: string
}
