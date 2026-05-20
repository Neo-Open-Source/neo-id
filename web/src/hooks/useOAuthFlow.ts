import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ROUTES } from '../constants'

interface OAuthFlowParams {
  siteId: string
  redirectUrl: string
  siteState: string
  isOIDCFlow: boolean
  popupMode: string
}

export const useOAuthFlow = (params: OAuthFlowParams) => {
  const navigate = useNavigate()

  const initiateOAuth = (provider: string) => {
    const q = new URLSearchParams()
    
    if (!params.isOIDCFlow) {
      if (params.siteId) q.set('site_id', params.siteId)
      if (params.redirectUrl) q.set('redirect_url', params.redirectUrl)
      if (params.siteState) q.set('site_state', params.siteState)
    }
    
    const queryString = q.toString()
    const url = queryString 
      ? `/api/auth/login/${provider}?${queryString}` 
      : `/api/auth/login/${provider}`
    
    window.location.href = url
  }

  const continueOIDCConsent = async (accessToken: string, clientId: string, redirectUri: string, state: string, scope: string) => {
    const response = await fetch('/api/auth/check-token', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        Authorization: `Bearer ${accessToken}` 
      },
      body: JSON.stringify({ 
        client_id: clientId, 
        redirect_uri: redirectUri, 
        state, 
        scope, 
        mode: params.popupMode 
      }),
    })

    const payload = await response.json().catch(() => null)
    
    if (!response.ok || !payload?.consent_url) {
      throw new Error(payload?.error || 'Failed to open consent page')
    }
    
    window.location.replace(payload.consent_url)
  }

  const handleAuthSuccess = async (data: unknown) => {
    const payload = data as Record<string, string>
    const { access_token, refresh_token, site_id, redirect_url, site_state } = payload

    if (params.isOIDCFlow) {
      const urlParams = new URLSearchParams(window.location.search)
      await continueOIDCConsent(
        access_token,
        urlParams.get('client_id') || '',
        urlParams.get('redirect_uri') || '',
        urlParams.get('state') || '',
        urlParams.get('scope') || 'openid profile email'
      )
      return
    }

    const finalSiteId = site_id || params.siteId
    const finalRedirectUrl = redirect_url || params.redirectUrl
    const finalSiteState = site_state || params.siteState

    if (finalSiteId && finalRedirectUrl) {
      const modeParam = params.popupMode === 'popup' ? '&mode=popup' : ''
      window.location.href = `/api/site/callback?site_id=${encodeURIComponent(finalSiteId)}&redirect_url=${encodeURIComponent(finalRedirectUrl)}&state=${encodeURIComponent(finalSiteState)}&token=${encodeURIComponent(access_token)}&refresh_token=${encodeURIComponent(refresh_token || '')}${modeParam}`
      return
    }

    navigate(ROUTES.HOME)
  }

  return {
    initiateOAuth,
    handleAuthSuccess,
  }
}
