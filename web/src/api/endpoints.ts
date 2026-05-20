import { api } from './client'

export async function passwordLogin(email: string, password: string, siteId?: string, redirectUrl?: string, siteState?: string) {
  return (await api.post('/api/auth/password/login', { email, password, site_id: siteId || undefined, redirect_url: redirectUrl || undefined, site_state: siteState || undefined })).data
}
export async function mfaVerify(email: string, code: string) {
  return (await api.post('/api/auth/mfa/verify', { email, code })).data
}
export async function totpLoginVerify(email: string, code: string, siteId?: string, redirectUrl?: string, siteState?: string) {
  return (await api.post('/api/auth/totp/verify', { email, code, site_id: siteId || undefined, redirect_url: redirectUrl || undefined, site_state: siteState || undefined })).data
}
export async function passwordRegister(email: string, password: string, display_name?: string) {
  return (await api.post('/api/auth/password/register', { email, password, display_name })).data
}
export async function resendVerifyEmail(email: string) {
  return (await api.post('/api/auth/verify-email/resend', { email })).data
}
export async function verifyEmailCode(email: string, code: string) {
  return (await api.post('/api/auth/verify-email/code', { email, code })).data
}
export async function getProfile() { return (await api.get('/api/user/profile')).data }
export async function updateProfile(payload: { display_name?: string; first_name?: string; last_name?: string; avatar?: string }) {
  return (await api.put('/api/user/profile', payload)).data
}
export async function requestEmailChange(email: string) {
  return (await api.post('/api/user/email/change', { email })).data
}
export async function getProviders() { return (await api.get('/api/user/providers')).data }
export async function unlinkProvider(provider: string) { return (await api.post('/api/user/provider/unlink', { provider })).data }
export async function setPassword(password: string, current_password?: string, mfa_code?: string) {
  return (await api.post('/api/user/password/set', { password, current_password, mfa_code: mfa_code || undefined })).data
}
export async function deleteAccountRequest() { return (await api.delete('/api/user/account')).data }
export async function getServices() { return (await api.get('/api/user/services')).data }
export async function connectService(service_name: string) { return (await api.post('/api/user/services/connect', { service_name })).data }
export async function disconnectService(service_name: string) { return (await api.post('/api/user/services/disconnect', { service_name })).data }
export async function registerService(payload: Record<string, unknown>) { return (await api.post('/api/service/register', payload)).data }
export async function getMyServices() { return (await api.get('/api/service/my')).data }
export async function deleteService(site_id: string) { return (await api.post('/api/service/delete', { site_id })).data }
export async function updateService(payload: Record<string, unknown>) { return (await api.post('/api/service/update', payload)).data }
export async function listServiceApps() { return (await api.get('/api/user/service-apps')).data }
export async function createServiceApp(name: string) { return (await api.post('/api/user/service-apps', { name })).data }
export async function revokeServiceApp(id: string) { return (await api.post('/api/user/service-apps/revoke', { id })).data }
export async function deleteServiceApp(id: string) { return (await api.post('/api/user/service-apps/delete', { id })).data }
export async function adminGetUsers(params: Record<string, unknown> = {}) { return (await api.get('/api/admin/users', { params })).data }
export async function adminSetUserRole(user_id: string, role: string) { return (await api.post('/api/admin/users/role', { user_id, role })).data }
export async function adminBanUser(user_id: string, reason: string, duration = 'permanent') { return (await api.post('/api/admin/users/ban', { user_id, reason, duration })).data }
export async function adminUnbanUser(user_id: string) { return (await api.post('/api/admin/users/unban', { user_id })).data }
export async function adminGetServices() { return (await api.get('/api/admin/services')).data }
export async function adminCreateService(service: Record<string, unknown>) { return (await api.post('/api/admin/services', service)).data }
export async function adminGetSites() { return (await api.get('/api/admin/sites')).data }
export async function adminRunLegalNotifyBatch() { return (await api.post('/api/admin/legal/notify/run')).data }
export async function completeProfile(display_name: string, avatar_url?: string) { return (await api.post('/api/user/profile/complete', { display_name, avatar_url })).data }
export async function setAvatarStock(avatar_url: string) { return (await api.post('/api/user/avatar', { avatar_url })).data }
export async function uploadAvatar(file: File) {
  const form = new FormData()
  form.append('avatar', file)
  return (await api.post('/api/user/avatar', form, { headers: { 'Content-Type': 'multipart/form-data' } })).data
}
export async function totpSetup() { return (await api.post('/api/user/mfa/totp/setup')).data }
export async function totpVerifyEnable(code: string) { return (await api.post('/api/user/mfa/totp/verify', { code })).data }
export async function totpDisable(code: string) { return (await api.post('/api/user/mfa/totp/disable', { code })).data }
export async function toggleEmailMFA(enabled: boolean, code?: string) {
  return (await api.post('/api/user/mfa/email/toggle', { enabled, ...(code ? { code } : {}) })).data
}
export async function sendMFACode() { return (await api.post('/api/user/mfa/email/send-code')).data }
export async function logout() { try { await api.post('/api/auth/logout') } catch { /* best-effort */ } }
export async function getSessions() { return (await api.get('/api/user/sessions')).data }
export async function revokeSession(id: string) { return (await api.post('/api/user/sessions/revoke', { id })).data }
export async function setRefreshDuration(months: number) { return (await api.post('/api/user/sessions/refresh-duration', { months })).data }
export async function adminListClients() { return (await api.get('/api/admin/clients')).data }
export async function adminCreateClient(payload: Record<string, unknown>) { return (await api.post('/api/admin/clients', payload)).data }
export async function adminUpdateClient(clientId: string, payload: Record<string, unknown>) { return (await api.patch(`/api/admin/clients/${clientId}`, payload)).data }
export async function adminDeleteClient(clientId: string) { return (await api.delete(`/api/admin/clients/${clientId}`)).data }
export async function listPasskeys() { return (await api.get('/api/user/passkeys')).data }
export async function createPasskey(payload: { name: string; credential_id: string; public_key?: string; transports?: string[]; device_type?: string }) {
  return (await api.post('/api/user/passkeys', payload)).data
}
export async function deletePasskey(id: string) { return (await api.post('/api/user/passkeys/delete', { id })).data }
export async function beginPasskeyRegistration(mfa_code?: string) {
  return (await api.post('/api/user/passkeys/register/options', { ...(mfa_code ? { mfa_code } : {}) })).data
}
export async function finishPasskeyRegistration(payload: Record<string, unknown>) {
  return (await api.post('/api/user/passkeys/register/verify', payload)).data
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
