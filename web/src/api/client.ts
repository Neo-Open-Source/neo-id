import axios, { type InternalAxiosRequestConfig } from 'axios'

export function getAccessToken(): string {
  return localStorage.getItem('accessToken') || ''
}
export function getRefreshToken(): string {
  return localStorage.getItem('refreshToken') || ''
}
export function setTokens({ accessToken, refreshToken }: { accessToken?: string; refreshToken?: string }) {
  if (accessToken) localStorage.setItem('accessToken', accessToken)
  if (refreshToken) localStorage.setItem('refreshToken', refreshToken)
}
export function clearTokens() {
  localStorage.removeItem('accessToken')
  localStorage.removeItem('refreshToken')
}

export const api = axios.create({ baseURL: '' })

api.interceptors.request.use((config) => {
  const token = getAccessToken()
  if (token) {
    config.headers = config.headers || {}
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

let isRefreshing = false
let refreshQueue: Array<{ resolve: (t: string) => void; reject: (e: unknown) => void }> = []

function processQueue(error: unknown, token: string | null = null) {
  refreshQueue.forEach((p) => error ? p.reject(error) : p.resolve(token!))
  refreshQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (
      error.response?.status !== 401 ||
      original._retry ||
      original.url?.includes('/api/auth/refresh')
    ) return Promise.reject(error)

    const refreshToken = getRefreshToken()
    if (!refreshToken) { clearTokens(); return Promise.reject(error) }

    if (isRefreshing) {
      return new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject })
      }).then((token) => {
        original.headers.Authorization = `Bearer ${token}`
        return api(original)
      })
    }

    original._retry = true
    isRefreshing = true
    try {
      const res = await axios.post('/api/auth/refresh', { refresh_token: refreshToken })
      const { access_token, refresh_token } = res.data
      setTokens({ accessToken: access_token, refreshToken: refresh_token })
      processQueue(null, access_token)
      original.headers.Authorization = `Bearer ${access_token}`
      return api(original)
    } catch (e) {
      processQueue(e, null)
      clearTokens()
      return Promise.reject(error)
    } finally {
      isRefreshing = false
    }
  }
)
