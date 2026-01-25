import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Typography, TextField, Button, Divider, Alert, Card, CardContent, Tabs, Tab, Link } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import GitHubIcon from '@mui/icons-material/GitHub'
import { passwordLogin, passwordRegister, resendVerifyEmail, verifyEmailCode } from '../api/endpoints'
import { setTokens } from '../api/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('verified') === '1') {
      setInfo('Email verified. You can sign in now.')
    }
  }, [])

  const oauthLogin = (provider) => {
    const params = new URLSearchParams(window.location.search)
    const siteId = params.get('site_id')
    const redirectUrl = params.get('redirect_url')
    const siteState = params.get('site_state')

    const q = new URLSearchParams()
    if (siteId) q.set('site_id', siteId)
    if (redirectUrl) q.set('redirect_url', redirectUrl)
    if (siteState) q.set('site_state', siteState)

    const qs = q.toString()
    window.location.href = qs ? `/api/auth/login/${provider}?${qs}` : `/api/auth/login/${provider}`
  }

  const onPasswordLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await passwordLogin(email, password)
      setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })

      const params = new URLSearchParams(window.location.search)
      const siteId = params.get('site_id')
      const redirectUrl = params.get('redirect_url')
      const siteState = params.get('site_state')

      if (siteId && redirectUrl) {
        const cb = `/api/site/callback?site_id=${encodeURIComponent(siteId)}` +
          `&redirect_url=${encodeURIComponent(redirectUrl)}` +
          `&state=${encodeURIComponent(siteState || '')}` +
          `&token=${encodeURIComponent(data.access_token)}`
        window.location.href = cb
        return
      }

      navigate('/dashboard')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const onPasswordRegister = async () => {
    setLoading(true)
    setError('')
    setInfo('')
    try {
      await passwordRegister(email, password, displayName)
      setInfo('We sent you a verification email. Please check your inbox and click the link to activate your account.')
      setMode('login')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    setLoading(true)
    setError('')
    setInfo('')
    try {
      await resendVerifyEmail(email)
      setInfo('Verification email sent. Check your inbox for a 6-digit code (or use the link).')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to resend email')
    } finally {
      setLoading(false)
    }
  }

  const onVerifyCode = async () => {
    setLoading(true)
    setError('')
    setInfo('')
    try {
      await verifyEmailCode(email, verificationCode)
      setInfo('Email verified. You can sign in now.')
      setVerificationCode('')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to verify code')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="sm">
        <Card elevation={0} sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Neo ID</Typography>
                <Typography color="text.secondary">Secure sign‑in for your apps</Typography>
              </Stack>

              <Tabs
                value={mode}
                onChange={(_, v) => setMode(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 44,
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.10)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  p: 0.5,
                  '& .MuiTabs-flexContainer': { gap: 0.5 },
                  '& .MuiTab-root': {
                    minHeight: 36,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.75)'
                  },
                  '& .Mui-selected': {
                    color: '#fff'
                  }
                }}
                TabIndicatorProps={{ style: { display: 'none' } }}
              >
                <Tab value="login" label="Sign in" />
                <Tab value="register" label="Create account" />
              </Tabs>

              {error && <Alert severity="error">{error}</Alert>}
              {info && <Alert severity="success">{info}</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button startIcon={<GoogleIcon />} size="large" variant="outlined" onClick={() => oauthLogin('google')} sx={{ flex: 1 }}>
                  Google
                </Button>
                <Button startIcon={<GitHubIcon />} size="large" variant="outlined" onClick={() => oauthLogin('github')} sx={{ flex: 1 }}>
                  GitHub
                </Button>
              </Stack>

              <Divider>or</Divider>

              <Stack spacing={2}>
                <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                {mode === 'register' && (
                  <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" />
                )}

                {mode === 'login' && (
                  <Box sx={{ mt: 2 }}>
                    <Alert severity="info" sx={{ mb: 2 }}>
                      Email not verified? Enter the 6-digit code from your email below
                    </Alert>
                    <TextField
                      label="Verification code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      inputProps={{ inputMode: 'numeric', pattern: '[0-9]*', maxLength: 6 }}
                      helperText="Enter the 6-digit code from the email"
                      fullWidth
                    />
                  </Box>
                )}

                {mode === 'login' && (
                  <Stack direction="row" spacing={2} sx={{ mt: 2 }}>
                    <Button 
                      size="large" 
                      variant="outlined" 
                      disabled={loading || !email} 
                      onClick={onResend}
                      sx={{ flex: 1 }}
                    >
                      Resend email
                    </Button>
                    <Button 
                      size="large" 
                      variant="contained" 
                      disabled={loading || !email || verificationCode.trim().length < 6} 
                      onClick={onVerifyCode}
                      sx={{ flex: 1 }}
                    >
                      Verify code
                    </Button>
                  </Stack>
                )}

                {mode === 'login' ? (
                  <Button size="large" variant="contained" disabled={loading} onClick={onPasswordLogin}>
                    Sign in
                  </Button>
                ) : (
                  <Button size="large" variant="contained" disabled={loading} onClick={onPasswordRegister}>
                    Create account
                  </Button>
                )}

                <Typography variant="body2" color="text.secondary">
                  Продолжая, вы соглашаетесь с 
                  <Link component={RouterLink} to="/terms" underline="hover">Условиями использования</Link>
                  {' '}и{' '}
                  <Link component={RouterLink} to="/privacy" underline="hover">Политикой конфиденциальности</Link>.
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
