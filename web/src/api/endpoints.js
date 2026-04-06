import { api } from './client'

export async function passwordLogin(email, password, siteId, redirectUrl, siteState) {
  const res = await api.post('/api/auth/password/login', {
    email, password,
    site_id: siteId || undefined,
    redirect_url: redirectUrl || undefined,
    site_state: siteState || undefined
  })
  return res.data
}

export async function mfaVerify(email, code) {
  const res = await api.post('/api/auth/mfa/verify', { email, code })
  return res.data
}

export async function totpLoginVerify(email, code, siteId, redirectUrl, siteState) {
  const res = await api.post('/api/auth/totp/verify', {
    email, code,
    site_id: siteId || undefined,
    redirect_url: redirectUrl || undefined,
    site_state: siteState || undefined
  })
  return res.data
}

export async function passwordRegister(email, password, display_name) {
  const res = await api.post('/api/auth/password/register', { email, password, display_name })
  return res.data
}

export async function resendVerifyEmail(email) {
  const res = await api.post('/api/auth/verify-email/resend', { email })
  return res.data
}

export async function verifyEmailCode(email, code) {
  const res = await api.post('/api/auth/verify-email/code', { email, code })
  return res.data
}

export async function getProfile() {
  const res = await api.get('/api/user/profile')
  return res.data
}

export async function getProviders() {
  const res = await api.get('/api/user/providers')
  return res.data
}

export async function unlinkProvider(provider) {
  const res = await api.post('/api/user/provider/unlink', { provider })
  return res.data
}

export async function setPassword(password, current_password, mfa_code) {
  const res = await api.post('/api/user/password/set', { password, current_password, mfa_code: mfa_code || undefined })
  return res.data
}

export async function getServices() {
  const res = await api.get('/api/user/services')
  return res.data
}

export async function connectService(service_name) {
  const res = await api.post('/api/user/services/connect', { service_name })
  return res.data
}

export async function disconnectService(service_name) {
  const res = await api.post('/api/user/services/disconnect', { service_name })
  return res.data
}

export async function registerSite(payload) {
  const res = await api.post('/api/site/register', payload)
  return res.data
}

export async function getMySites() {
  const res = await api.get('/api/site/my')
  return res.data
}

export async function listServiceApps() {
  const res = await api.get('/api/user/service-apps')
  return res.data
}

export async function createServiceApp(name) {
  const res = await api.post('/api/user/service-apps', { name })
  return res.data
}

export async function revokeServiceApp(id) {
  const res = await api.post('/api/user/service-apps/revoke', { id })
  return res.data
}

export async function deleteServiceApp(id) {
  const res = await api.post('/api/user/service-apps/delete', { id })
  return res.data
}

export async function adminGetUsers(params = {}) {
  const res = await api.get('/api/admin/users', { params })
  return res.data
}

export async function adminSetUserRole(user_id, role) {
  const res = await api.post('/api/admin/users/role', { user_id, role })
  return res.data
}

export async function adminBanUser(user_id, reason, duration = 'permanent') {
  const res = await api.post('/api/admin/users/ban', { user_id, reason, duration })
  return res.data
}

export async function adminUnbanUser(user_id) {
  const res = await api.post('/api/admin/users/unban', { user_id })
  return res.data
}

export async function adminGetServices() {
  const res = await api.get('/api/admin/services')
  return res.data
}

export async function adminCreateService(service) {
  const res = await api.post('/api/admin/services', service)
  return res.data
}

export async function adminGetSites() {
  const res = await api.get('/api/admin/sites')
  return res.data
}

export async function completeProfile(display_name, avatar_url) {
  const res = await api.post('/api/user/profile/complete', { display_name, avatar_url })
  return res.data
}

export async function setAvatarStock(avatar_url) {
  const res = await api.post('/api/user/avatar', { avatar_url })
  return res.data
}

export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  const res = await api.post('/api/user/avatar', form, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res.data
}

// TOTP
export async function totpSetup() {
  const res = await api.post('/api/user/mfa/totp/setup')
  return res.data
}

export async function totpVerifyEnable(code) {
  const res = await api.post('/api/user/mfa/totp/verify', { code })
  return res.data
}

export async function totpDisable(code) {
  const res = await api.post('/api/user/mfa/totp/disable', { code })
  return res.data
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

export async function toggleEmailMFA(enabled) {
  const res = await api.post('/api/user/mfa/email/toggle', { enabled })
  return res.data
}

export async function logout() {
  try {
    await api.post('/api/auth/logout')
  } catch {
    // best-effort — clear tokens locally regardless
  }
}

export async function getSessions() {
  const res = await api.get('/api/user/sessions')
  return res.data
}

export async function revokeSession(id) {
  const res = await api.post('/api/user/sessions/revoke', { id })
  return res.data
}

export async function setRefreshDuration(months) {
  const res = await api.post('/api/user/sessions/refresh-duration', { months })
  return res.data
}

// Admin clients (OIDC) management
export async function adminListClients() {
  const res = await api.get('/api/admin/clients')
  return res.data
}

export async function adminCreateClient(payload) {
  const res = await api.post('/api/admin/clients', payload)
  return res.data
}

export async function adminUpdateClient(clientId, payload) {
  const res = await api.patch(`/api/admin/clients/${clientId}`, payload)
  return res.data
}

export async function adminDeleteClient(clientId) {
  const res = await api.delete(`/api/admin/clients/${clientId}`)
  return res.data
}
