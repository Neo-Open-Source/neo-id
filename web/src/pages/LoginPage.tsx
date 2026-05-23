import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { AlertBanner } from '@neo-open-source/ui-web'
import { passwordLogin, passwordRegister } from '../api/endpoints'
import { getAccessToken, setTokens } from '../api/client'
import TOTPLoginStep from '../components/TOTPLoginStep'
import AuthShell from '../components/AuthShell'
import AuthTabs from '../components/AuthTabs'
import OAuthButtons from '../components/OAuthButtons'
import AuthForm from '../components/AuthForm'
import { useQueryParams } from '../hooks/useQueryParams'
import { useOAuthFlow } from '../hooks/useOAuthFlow'
import { useMFASession } from '../hooks/useMFASession'
import { ROUTES } from '../constants'
import styles from '../styles/LoginPage.module.css'

type AuthTab = 'login' | 'register'
type RequestError = { response?: { status?: number; data?: { error?: string; message?: string } }; message?: string }

export default function LoginPage() {
  const navigate = useNavigate()
  const { get, getBoolean } = useQueryParams()
  const { storeMFASession } = useMFASession()

  const [tab, setTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [totpRequired, setTotpRequired] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [turnstileToken, setTurnstileToken] = useState('')

  const siteId = get('client_id') || get('site_id')
  const redirectUrl = get('redirect_uri') || get('redirect_url')
  const siteState = get('state') || get('site_state')
  const isOIDCFlow = !!(get('client_id') && get('redirect_uri'))
  const popupMode = get('mode')
  const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY

  const { initiateOAuth, handleAuthSuccess } = useOAuthFlow({
    siteId,
    redirectUrl,
    siteState,
    isOIDCFlow,
    popupMode,
  })

  useEffect(() => {
    if (getAccessToken()) {
      if (isOIDCFlow) {
        // Already logged in — skip login form, go straight to consent
        const token = getAccessToken()
        const urlParams = new URLSearchParams(window.location.search)
        fetch('/api/auth/check-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            client_id: urlParams.get('client_id') || '',
            redirect_uri: urlParams.get('redirect_uri') || '',
            state: urlParams.get('state') || '',
            scope: urlParams.get('scope') || 'openid profile email',
            mode: popupMode,
          }),
        })
          .then(r => r.json())
          .then(payload => { if (payload?.consent_url) window.location.replace(payload.consent_url) })
          .catch(() => navigate('/'))
      } else {
        navigate('/')
      }
      return
    }
    if (getBoolean('verified')) {
      setInfo('Email verified. You can sign in now.')
    }
  }, [navigate])

  useEffect(() => {
    if (!turnstileSiteKey) return

    const mount = document.getElementById('turnstile-widget')
    if (!mount) return

    mount.innerHTML = ''
    setTurnstileToken('')

    const renderWidget = () => {
      if (!window.turnstile) return
      window.turnstile.render('#turnstile-widget', {
        sitekey: turnstileSiteKey,
        callback: (token: string) => setTurnstileToken(token),
        'expired-callback': () => setTurnstileToken(''),
        'error-callback': () => setTurnstileToken(''),
      })
    }

    if (window.turnstile) {
      renderWidget()
      return
    }

    const existingScript = document.getElementById('cf-turnstile-script') as HTMLScriptElement | null
    if (existingScript) {
      existingScript.addEventListener('load', renderWidget, { once: true })
      return
    }

    const script = document.createElement('script')
    script.id = 'cf-turnstile-script'
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.defer = true
    script.addEventListener('load', renderWidget, { once: true })
    document.body.appendChild(script)
  }, [turnstileSiteKey, tab])

  const handleLogin = async () => {
    if (loading) return

    setLoading(true)
    setError('')

    try {
      if (!turnstileSiteKey) {
        setError('Captcha is not configured. Please contact support.')
        return
      }
      if (!turnstileToken) {
        setError('Please complete the captcha challenge.')
        return
      }

      const data = await passwordLogin(email, password, turnstileToken, siteId, redirectUrl, siteState) as Record<string, unknown>

      if (data.totp_required) {
        setTotpRequired(true)
        return
      }

      if (data.mfa_required) {
        storeMFASession({
          email,
          verifyType: 'mfa',
          isOIDC: isOIDCFlow,
          clientId: get('client_id'),
          redirectUri: get('redirect_uri'),
          state: get('state'),
          scope: get('scope') || 'openid profile email',
          mode: popupMode,
          siteId,
          redirectUrl,
          siteState,
        })
        navigate(ROUTES.VERIFY)
        return
      }

      setTokens({ 
        accessToken: data.access_token as string | undefined, 
        refreshToken: data.refresh_token as string | undefined,
      })
      
      await handleAuthSuccess(data)
    } catch (err: unknown) {
      const requestError = err as RequestError
      const status = requestError?.response?.status
      const errorCode = requestError?.response?.data?.error || ''
      const errorMessage = requestError?.response?.data?.message || requestError?.message
      
      // Map error codes to user-friendly messages
      let message = errorMessage
      if (errorCode === 'invalid_credentials') {
        message = 'Invalid email or password'
      } else if (errorCode === 'user_not_found') {
        message = 'No account found with this email'
      } else if (errorCode === 'invalid_password') {
        message = 'Incorrect password'
      } else if (!message) {
        message = 'Login failed. Please try again.'
      }

      if (status === 403 && (errorCode.includes('not_verified') || message.toLowerCase().includes('not verified'))) {
        storeMFASession({
          email,
          verifyType: 'email',
          isOIDC: isOIDCFlow,
          clientId: get('client_id'),
          redirectUri: get('redirect_uri'),
          state: get('state'),
          scope: get('scope') || 'openid profile email',
          mode: popupMode,
          siteId,
          redirectUrl,
          siteState,
        })
        navigate(ROUTES.VERIFY)
        return
      }

      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async () => {
    if (loading) return

    setLoading(true)
    setError('')

    try {
      if (!ageConfirmed) {
        setError('Please confirm that you are 16 or older to create an account.')
        return
      }
      if (!turnstileSiteKey) {
        setError('Captcha is not configured. Please contact support.')
        return
      }
      if (!turnstileToken) {
        setError('Please complete the captcha challenge.')
        return
      }
      await passwordRegister(email, password, turnstileToken, undefined, true)
      
      storeMFASession({
        email,
        verifyType: 'email',
      })
      
      navigate(ROUTES.VERIFY)
    } catch (err: unknown) {
      const requestError = err as RequestError
      const errorCode = requestError?.response?.data?.error || ''
      const errorMessage = requestError?.response?.data?.message || requestError?.message
      
      // Map error codes to user-friendly messages
      let message = errorMessage
      if (errorCode === 'email_exists') {
        message = 'An account with this email already exists'
      } else if (errorCode === 'invalid_email') {
        message = 'Please enter a valid email address'
      } else if (errorCode === 'weak_password') {
        message = 'Password is too weak. Use at least 8 characters.'
      } else if (!message) {
        message = 'Registration failed. Please try again.'
      }
      
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      tab === 'login' ? handleLogin() : handleRegister()
    }
  }

  const handleTabChange = (newTab: AuthTab) => {
    setTab(newTab)
    setError('')
    setInfo('')
    if (newTab === 'login') setAgeConfirmed(false)
  }

  if (totpRequired) {
    return (
      <TOTPLoginStep
        email={email}
        siteId={siteId}
        redirectUrl={redirectUrl}
        siteState={siteState}
        onBack={() => setTotpRequired(false)}
        onSuccess={handleAuthSuccess}
      />
    )
  }

  return (
    <AuthShell
      desktopSimple
      title="Welcome to Neo ID"
      description={
        tab === 'login'
          ? 'Sign in with email, Google, or GitHub.'
          : 'Create your account with email, Google, or GitHub.'
      }
    >
      <AuthTabs activeTab={tab} onTabChange={handleTabChange} />

      {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
      {info && <AlertBanner tone="success" title={info} onDismiss={() => setInfo('')} />}

      <OAuthButtons onOAuthClick={initiateOAuth} />

      <div className={styles.divider}>
        <span>or continue with email</span>
      </div>

      <AuthForm
        email={email}
        password={password}
        loading={loading}
        isLogin={tab === 'login'}
        onEmailChange={setEmail}
        onPasswordChange={setPassword}
        onSubmit={tab === 'login' ? handleLogin : handleRegister}
        onKeyDown={handleKeyDown}
        captchaSlot={<div id="turnstile-widget" className={styles.turnstileWrap} />}
      />
      {tab === 'register' ? (
        <label className={styles.ageConsent}>
          <input type="checkbox" checked={ageConfirmed} onChange={(e) => setAgeConfirmed(e.target.checked)} />
          <span>I am 16 years old or older.</span>
        </label>
      ) : null}

      <p className={styles.legal}>
        By continuing, you agree to our <Link to={ROUTES.TERMS}>Terms</Link> and{' '}
        <Link to={ROUTES.PRIVACY}>Privacy Policy</Link>.
      </p>
    </AuthShell>
  )
}
