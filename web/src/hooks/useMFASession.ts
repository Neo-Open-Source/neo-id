import { SESSION_STORAGE_KEYS } from '../constants'

interface MFASessionData {
  email: string
  verifyType: 'email' | 'mfa'
  isOIDC?: boolean
  clientId?: string
  redirectUri?: string
  state?: string
  scope?: string
  mode?: string
  siteId?: string
  redirectUrl?: string
  siteState?: string
}

export const useMFASession = () => {
  const storeMFASession = (data: MFASessionData) => {
    sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_EMAIL, data.email)
    sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_VERIFY_TYPE, data.verifyType)

    if (data.isOIDC) {
      sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_OIDC, '1')
      if (data.clientId) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_CLIENT_ID, data.clientId)
      if (data.redirectUri) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_REDIRECT_URI, data.redirectUri)
      if (data.state) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_STATE, data.state)
      if (data.scope) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_SCOPE, data.scope)
      if (data.mode) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_MODE, data.mode)
    }

    if (data.siteId) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_SITE_ID, data.siteId)
    if (data.redirectUrl) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_REDIRECT_URL, data.redirectUrl)
    if (data.siteState) sessionStorage.setItem(SESSION_STORAGE_KEYS.MFA_SITE_STATE, data.siteState)
  }

  const getMFASession = (): MFASessionData | null => {
    const email = sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_EMAIL)
    const verifyType = sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_VERIFY_TYPE) as 'email' | 'mfa' | null

    if (!email || !verifyType) return null

    return {
      email,
      verifyType,
      isOIDC: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_OIDC) === '1',
      clientId: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_CLIENT_ID) || undefined,
      redirectUri: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_REDIRECT_URI) || undefined,
      state: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_STATE) || undefined,
      scope: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_SCOPE) || undefined,
      mode: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_MODE) || undefined,
      siteId: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_SITE_ID) || undefined,
      redirectUrl: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_REDIRECT_URL) || undefined,
      siteState: sessionStorage.getItem(SESSION_STORAGE_KEYS.MFA_SITE_STATE) || undefined,
    }
  }

  const clearMFASession = () => {
    Object.values(SESSION_STORAGE_KEYS).forEach(key => {
      sessionStorage.removeItem(key)
    })
  }

  return {
    storeMFASession,
    getMFASession,
    clearMFASession,
  }
}
