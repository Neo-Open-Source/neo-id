import { setTokens } from '../api/client'

export function consumeTokensFromHash() {
  const hash = window.location.hash || ''
  if (!hash.startsWith('#')) return false
  const params = new URLSearchParams(hash.slice(1))
  const accessToken = params.get('access_token')
  const refreshToken = params.get('refresh_token')
  if (!accessToken) return false
  setTokens({ accessToken, refreshToken })
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search)
  return true
}
