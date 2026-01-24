import { api } from './client'

export async function passwordLogin(email, password) {
  const res = await api.post('/api/auth/password/login', { email, password })
  return res.data
}

export async function passwordRegister(email, password, display_name) {
  const res = await api.post('/api/auth/password/register', { email, password, display_name })
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

export async function setPassword(password, current_password) {
  const res = await api.post('/api/user/password/set', { password, current_password })
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
