import { useEffect, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Typography, TextField, Button, Divider, Alert, Link, Tabs, Tab, useTheme } from '@mui/material'
import { passwordLogin, passwordRegister } from '../api/endpoints'
import { setTokens } from '../api/client'
import ThemeToggle from '../components/ThemeToggle.jsx'
import TOTPLoginStep from '../components/TOTPLoginStep.jsx'

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  )
}

function GitHubIcon({ color }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill={color || 'currentColor'}>
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
    </svg>
  )
}

export default function LoginPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false) // checking existing token
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [totpRequired, setTotpRequired] = useState(false)

  const params = new URLSearchParams(window.location.search)
  const siteId = params.get('client_id') || params.get('site_id') || ''
  const redirectUrl = params.get('redirect_uri') || params.get('redirect_url') || ''
  const siteState = params.get('state') || params.get('site_state') || ''
  const popupMode = params.get('mode') || ''
  const passedToken = params.get('token') || ''

  useEffect(() => {
    if (params.get('verified') === '1') setInfo('Email verified. You can sign in now.')
  }, [])

  // Auto-complete: if already logged in to Neo ID, skip login form and go to consent
  useEffect(() => {
    if (!siteId) return
    if (params.get('token')) return

    const token = localStorage.getItem('accessToken') || ''
    if (!token) return

    setChecking(true)
    fetch('/api/auth/check-token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({
        client_id: siteId,
        redirect_uri: redirectUrl || window.location.origin + '/auth/callback',
        state: siteState,
        scope: 'openid profile email',
        mode: popupMode,
      }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.consent_url) window.location.replace(data.consent_url)
        else setChecking(false)
      })
      .catch(() => setChecking(false))
  }, [])

  const oauthLogin = (provider) => {
    const q = new URLSearchParams()
    if (siteId) q.set('site_id', siteId)
    if (redirectUrl) q.set('redirect_url', redirectUrl)
    if (siteState) q.set('site_state', siteState)
    const qs = q.toString()
    window.location.href = qs ? `/api/auth/login/${provider}?${qs}` : `/api/auth/login/${provider}`
  }

  const handleSuccess = (data) => {
    setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
    const sid = data.site_id || siteId
    const rurl = data.redirect_url || redirectUrl
    const ss = data.site_state || siteState
    if (sid && rurl) {
      const modeParam = popupMode === 'popup' ? '&mode=popup' : ''
      window.location.href = `/api/site/callback?site_id=${encodeURIComponent(sid)}&redirect_url=${encodeURIComponent(rurl)}&state=${encodeURIComponent(ss)}&token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token || '')}${modeParam}`
      return
    }
    navigate('/dashboard')
  }

  const onLogin = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const data = await passwordLogin(email, password, siteId, redirectUrl, siteState)
      if (data.totp_required) { setTotpRequired(true); return }
      if (data.mfa_required) {
        sessionStorage.setItem('mfa_email', data.email || email)
        sessionStorage.setItem('mfa_verify_type', 'mfa')
        if (siteId) sessionStorage.setItem('mfa_site_id', siteId)
        if (redirectUrl) sessionStorage.setItem('mfa_redirect_url', redirectUrl)
        if (siteState) sessionStorage.setItem('mfa_site_state', siteState)
        navigate('/verify')
        return
      }
      handleSuccess(data)
    } catch (e) {
      const status = e?.response?.status
      const msg = e?.response?.data?.error || e?.message || 'Login failed'
      if (status === 403 && msg.toLowerCase().includes('not verified')) {
        sessionStorage.setItem('mfa_email', email)
        sessionStorage.setItem('mfa_verify_type', 'email')
        if (siteId) sessionStorage.setItem('mfa_site_id', siteId)
        if (redirectUrl) sessionStorage.setItem('mfa_redirect_url', redirectUrl)
        if (siteState) sessionStorage.setItem('mfa_site_state', siteState)
        navigate('/verify')
        return
      }
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      await passwordRegister(email, password)
      sessionStorage.setItem('mfa_email', email)
      sessionStorage.setItem('mfa_verify_type', 'email')
      navigate('/verify')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key !== 'Enter') return
    if (mode === 'login') onLogin()
    else onRegister()
  }

  // Card shadow — subtle in light, more visible in dark
  const cardSx = {
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    p: { xs: 3, sm: 4 },
    boxShadow: dark
      ? '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)'
      : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)'
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Box sx={{ position: 'fixed', top: 16, right: 16 }}>
          <ThemeToggle />
        </Box>

        {totpRequired ? (
          <TOTPLoginStep
            email={email}
            siteId={siteId}
            redirectUrl={redirectUrl}
            siteState={siteState}
            onBack={() => setTotpRequired(false)}
            onSuccess={handleSuccess}
          />
        ) : (
          <Box sx={cardSx}>
            <Stack spacing={3}>

              <Stack spacing={0.5}>
                <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>Neo ID</Typography>
                <Typography variant="body2" color="text.secondary">
                  {mode === 'login' ? 'Sign in to your account' : 'Create a new account'}
                </Typography>
              </Stack>

              <Tabs
                value={mode}
                onChange={(_, v) => { setMode(v); setError(''); setInfo('') }}
                sx={{ borderBottom: '1px solid', borderColor: 'divider', minHeight: 40 }}
                TabIndicatorProps={{ style: { height: 2 } }}
              >
                <Tab value="login" label="Sign in" sx={{ minHeight: 40, py: 0, px: 0, mr: 3, fontSize: '0.875rem' }} />
                <Tab value="register" label="Create account" sx={{ minHeight: 40, py: 0, px: 0, fontSize: '0.875rem' }} />
              </Tabs>

              {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
              {info && <Alert severity="success" sx={{ py: 0.5 }}>{info}</Alert>}

              <Stack spacing={1.5}>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => oauthLogin('google')}
                  sx={{ height: 42, gap: 1.5, justifyContent: 'center' }}
                  startIcon={<GoogleIcon />}
                >
                  Continue with Google
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  onClick={() => oauthLogin('github')}
                  sx={{ height: 42, gap: 1.5, justifyContent: 'center' }}
                  startIcon={<GitHubIcon color={dark ? '#ffffff' : '#24292f'} />}
                >
                  Continue with GitHub
                </Button>
              </Stack>

              <Divider>
                <Typography variant="caption" color="text.secondary" sx={{ px: 1 }}>or</Typography>
              </Divider>

              <Stack spacing={2}>
                <TextField label="Email" size="small" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" onKeyDown={onKeyDown} />
                <TextField
                  label="Password" size="small" type="password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  onKeyDown={onKeyDown}
                />

                {mode === 'login' ? (
                  <Button variant="contained" fullWidth disabled={loading} onClick={onLogin} sx={{ height: 42 }}>
                    {loading ? 'Signing in...' : 'Sign in'}
                  </Button>
                ) : (
                  <Button variant="contained" fullWidth disabled={loading} onClick={onRegister} sx={{ height: 42 }}>
                    {loading ? 'Creating...' : 'Create account'}
                  </Button>
                )}
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                By continuing, you agree to our{' '}
                <Link component={RouterLink} to="/terms" underline="hover" color="text.primary">Terms</Link>
                {' '}and{' '}
                <Link component={RouterLink} to="/privacy" underline="hover" color="text.primary">Privacy Policy</Link>
              </Typography>

            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  )
}
