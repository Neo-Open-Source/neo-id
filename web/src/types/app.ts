export interface UserProfile {
  id?: string
  unified_id?: string
  email: string
  display_name?: string
  first_name?: string
  last_name?: string
  avatar?: string
  role?: string
  email_verified?: boolean
  pending_email?: string
  totp_enabled?: boolean
  email_mfa_enabled?: boolean
  passkeys_count?: number
  refresh_duration_months?: number
  [key: string]: unknown
}

export interface OAuthProvider {
  provider: string
  external_id?: string
  [key: string]: unknown
}

export interface UserServicesItem {
  name: string
  display_name?: string
  description?: string
}

export interface UserServicesResponse {
  connected_services?: UserServicesItem[]
  available_services?: UserServicesItem[]
}

export interface ProvidersResponse {
  oauth_providers?: OAuthProvider[]
  has_password?: boolean
}

export interface AdminUser {
  unified_id: string
  email?: string
  display_name?: string
  avatar?: string
  role?: string
  is_banned?: boolean
}

export interface AdminUsersResponse {
  users?: AdminUser[]
  pagination?: {
    page?: number
    limit?: number
    total?: number
    pages?: number
  }
}

export interface AdminService {
  name: string
  display_name?: string
  description?: string
  is_active?: boolean
}

export interface AdminServicesResponse {
  services?: AdminService[]
}

export interface AdminSite {
  site_id: string
  name: string
  domain?: string
  owner_email?: string
  plan?: string
  is_active?: boolean
}

export interface AdminSitesResponse {
  sites?: AdminSite[]
}

export interface LegalNotifyRunResponse {
  version?: string
  sent?: number
  failed?: number
  skipped?: number
  has_more?: boolean
  next_from?: string
}

export interface DeveloperService {
  site_id: string
  name: string
  domain?: string
  api_key?: string
  api_secret?: string
  allowed_origins?: string[]
  webhook_url?: string
}

export interface DeveloperMyServicesResponse {
  sites?: DeveloperService[]
}

export interface AdminNewServicePayload {
  name: string
  display_name: string
  description: string
}
