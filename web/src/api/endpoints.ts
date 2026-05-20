import { api } from './client'
import type {
  AdminNewServicePayload,
  AdminServicesResponse,
  AdminSitesResponse,
  AdminUsersResponse,
  DeveloperMyServicesResponse,
  LegalNotifyRunResponse,
  ProvidersResponse,
  UserProfile,
  UserServicesResponse,
} from '../types/app'
import type {
  AdminClientPayload,
  AdminUsersQuery,
  ApiRequestConfig,
  AuthVerifyResponse,
  AvatarResponse,
  CreatePasskeyPayload,
  FinishPasskeyPayload,
  ProfileUpdatePayload,
  QueryParams,
  RegisterServicePayload,
  UpdateServicePayload,
} from '../types/api'

async function get<T = unknown>(url: string, params?: QueryParams): Promise<T> {
  const response = await api.get<T>(url, params ? { params } : undefined)
  return response.data
}

async function post<T = unknown>(url: string, payload?: unknown, config?: ApiRequestConfig): Promise<T> {
  const response = await api.post<T>(url, payload, config)
  return response.data
}

async function put<T = unknown>(url: string, payload?: unknown): Promise<T> {
  const response = await api.put<T>(url, payload)
  return response.data
}

async function patch<T = unknown>(url: string, payload?: unknown): Promise<T> {
  const response = await api.patch<T>(url, payload)
  return response.data
}

async function del<T = unknown>(url: string): Promise<T> {
  const response = await api.delete<T>(url)
  return response.data
}

export async function passwordLogin(email: string, password: string, siteId?: string, redirectUrl?: string, siteState?: string) {
  return post('/api/auth/password/login', {
    email,
    password,
    site_id: siteId || undefined,
    redirect_url: redirectUrl || undefined,
    site_state: siteState || undefined,
  })
}

export async function mfaVerify(email: string, code: string) {
  return post<AuthVerifyResponse>('/api/auth/mfa/verify', { email, code })
}

export async function totpLoginVerify(email: string, code: string, siteId?: string, redirectUrl?: string, siteState?: string) {
  return post<AuthVerifyResponse>('/api/auth/totp/verify', {
    email,
    code,
    site_id: siteId || undefined,
    redirect_url: redirectUrl || undefined,
    site_state: siteState || undefined,
  })
}

export async function passwordRegister(email: string, password: string, display_name?: string) {
  return post('/api/auth/password/register', { email, password, display_name })
}

export async function resendVerifyEmail(email: string) {
  return post('/api/auth/verify-email/resend', { email })
}

export async function verifyEmailCode(email: string, code: string) {
  return post<Partial<AuthVerifyResponse>>('/api/auth/verify-email/code', { email, code })
}

export async function getProfile() {
  return get<UserProfile>('/api/user/profile')
}

export async function updateProfile(payload: ProfileUpdatePayload) {
  return put('/api/user/profile', payload)
}

export async function requestEmailChange(email: string) {
  return post('/api/user/email/change', { email })
}

export async function getProviders() {
  return get<ProvidersResponse>('/api/user/providers')
}

export async function unlinkProvider(provider: string) {
  return post('/api/user/provider/unlink', { provider })
}

export async function setPassword(password: string, current_password?: string, mfa_code?: string) {
  return post('/api/user/password/set', {
    password,
    current_password,
    mfa_code: mfa_code || undefined,
  })
}

export async function deleteAccountRequest() {
  return del('/api/user/account')
}

export async function getServices() {
  return get<UserServicesResponse>('/api/user/services')
}

export async function connectService(service_name: string) {
  return post('/api/user/services/connect', { service_name })
}

export async function disconnectService(service_name: string) {
  return post('/api/user/services/disconnect', { service_name })
}

export async function registerService(payload: RegisterServicePayload) {
  return post('/api/service/register', payload)
}

export async function getMyServices() {
  return get<DeveloperMyServicesResponse>('/api/service/my')
}

export async function deleteService(site_id: string) {
  return post('/api/service/delete', { site_id })
}

export async function updateService(payload: UpdateServicePayload) {
  return post('/api/service/update', payload)
}

export async function listServiceApps() {
  return get('/api/user/service-apps')
}

export async function createServiceApp(name: string) {
  return post('/api/user/service-apps', { name })
}

export async function revokeServiceApp(id: string) {
  return post('/api/user/service-apps/revoke', { id })
}

export async function deleteServiceApp(id: string) {
  return post('/api/user/service-apps/delete', { id })
}

export async function adminGetUsers(params: AdminUsersQuery = {}) {
  return get<AdminUsersResponse>('/api/admin/users', params)
}

export async function adminSetUserRole(user_id: string, role: string) {
  return post('/api/admin/users/role', { user_id, role })
}

export async function adminBanUser(user_id: string, reason: string, duration = 'permanent') {
  return post('/api/admin/users/ban', { user_id, reason, duration })
}

export async function adminUnbanUser(user_id: string) {
  return post('/api/admin/users/unban', { user_id })
}

export async function adminGetServices() {
  return get<AdminServicesResponse>('/api/admin/services')
}

export async function adminCreateService(service: AdminNewServicePayload) {
  return post('/api/admin/services', service)
}

export async function adminGetSites() {
  return get<AdminSitesResponse>('/api/admin/sites')
}

export async function adminRunLegalNotifyBatch() {
  return post<LegalNotifyRunResponse>('/api/admin/legal/notify/run')
}

export async function completeProfile(display_name: string, avatar_url?: string) {
  return post('/api/user/profile/complete', { display_name, avatar_url })
}

export async function setAvatarStock(avatar_url: string) {
  return post<AvatarResponse>('/api/user/avatar', { avatar_url })
}

export async function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return post<AvatarResponse>('/api/user/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export async function totpSetup() {
  return post('/api/user/mfa/totp/setup')
}

export async function totpVerifyEnable(code: string) {
  return post('/api/user/mfa/totp/verify', { code })
}

export async function totpDisable(code: string) {
  return post('/api/user/mfa/totp/disable', { code })
}

export async function toggleEmailMFA(enabled: boolean, code?: string) {
  return post('/api/user/mfa/email/toggle', { enabled, ...(code ? { code } : {}) })
}

export async function sendMFACode() {
  return post('/api/user/mfa/email/send-code')
}

export async function logout() {
  try {
    await post('/api/auth/logout')
  } catch {
    // best-effort
  }
}

export async function getSessions() {
  return get('/api/user/sessions')
}

export async function revokeSession(id: string) {
  return post('/api/user/sessions/revoke', { id })
}

export async function setRefreshDuration(months: number) {
  return post('/api/user/sessions/refresh-duration', { months })
}

export async function adminListClients() {
  return get('/api/admin/clients')
}

export async function adminCreateClient(payload: AdminClientPayload) {
  return post('/api/admin/clients', payload)
}

export async function adminUpdateClient(clientId: string, payload: Partial<AdminClientPayload>) {
  return patch(`/api/admin/clients/${clientId}`, payload)
}

export async function adminDeleteClient(clientId: string) {
  return del(`/api/admin/clients/${clientId}`)
}

export async function listPasskeys() {
  return get('/api/user/passkeys')
}

export async function createPasskey(payload: CreatePasskeyPayload) {
  return post('/api/user/passkeys', payload)
}

export async function deletePasskey(id: string) {
  return post('/api/user/passkeys/delete', { id })
}

export async function beginPasskeyRegistration(mfa_code?: string) {
  return post('/api/user/passkeys/register/options', {
    ...(mfa_code ? { mfa_code } : {}),
  })
}

export async function finishPasskeyRegistration(payload: FinishPasskeyPayload) {
  return post('/api/user/passkeys/register/verify', payload)
}

export const STOCK_AVATARS = [
  '/avatars/alvan-nee-ZCHj_2lJP00-unsplash.jpg',
  '/avatars/danila-balashkin-MslerTjRXec-unsplash.jpg',
  '/avatars/gabriel-silverio-K_b41GaWC5Y-unsplash.jpg',
  '/avatars/jei-lee-yRXuXvy4sQ4-unsplash.jpg',
  '/avatars/polina-abramova-i1qKR27PqDc-unsplash.jpg',
  '/avatars/ray-hennessy-xUUZcpQlqpM-unsplash.jpg',
  '/avatars/taylor-8Vt2haq8NSQ-unsplash.jpg',
  '/avatars/zoltan-tasi-yanhwFwyoaU-unsplash.jpg',
]
