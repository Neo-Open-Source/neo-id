import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Typography, Button, Alert, Link } from '@mui/material'
import { mfaVerify, verifyEmailCode, resendVerifyEmail, totpLoginVerify } from '../api/endpoints'
import { setTokens } from '../api/client'
import ThemeToggle from '../components/ThemeToggle.jsx'

export default function VerifyPage() {
  const navigate = useNavigate()
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const refs = useRef([])
  const cooldownRef = useRef(null)

  const email = sessionStorage.getItem('mfa_email') || ''
  const verifyType = sessionStorage.getItem('mfa_verify_type') || 'mfa'
  const siteId = sessionStorage.getItem('mfa_site_id') || ''
  const redirectUrl = sessionStorage.getItem('mfa_redirect_url') || ''
  const siteState = sessionStorage.getItem('mfa_site_state') || ''
  const mfaOIDC = sessionStorage.getItem('mfa_oidc') === '1'
  const mfaClientID = sessionStorage.getItem('mfa_client_id') || ''
  const mfaRedirectURI = sessionStorage.getItem('mfa_redirect_uri') || ''
  const mfaState = sessionStorage.getItem('mfa_state') || ''
  const mfaScope = sessionStorage.getItem('mfa_scope') || 'openid profile email'
  const mfaMode = sessionStorage.getItem('mfa_mode') || ''
  const isEmailVerify = verifyType === 'email'

  const startCooldown = (seconds = 60) => {
    setResendCooldown(seconds)
    clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => {
      setResendCooldown((v) => {
        if (v <= 1) { clearInterval(cooldownRef.current); return 0 }
        return v - 1
      })
    }, 1000)
  }

  useEffect(() => {
    if (!email) {
      // Check hash for OAuth MFA redirect (e.g. /verify#mfa_email=...&mfa_verify_type=...)
      const hash = window.location.hash.slice(1)
      if (hash) {
        const p = new URLSearchParams(hash)
        const hashEmail = p.get('mfa_email')
        const hashType = p.get('mfa_verify_type')
        const hashOIDC = p.get('mfa_oidc')
        if (hashEmail) {
          sessionStorage.setItem('mfa_email', hashEmail)
          if (hashType) sessionStorage.setItem('mfa_verify_type', hashType)
          if (hashOIDC === '1') {
            sessionStorage.setItem('mfa_oidc', '1')
            sessionStorage.setItem('mfa_client_id', p.get('mfa_client_id') || '')
            sessionStorage.setItem('mfa_redirect_uri', p.get('mfa_redirect_uri') || '')
            sessionStorage.setItem('mfa_state', p.get('mfa_state') || '')
            sessionStorage.setItem('mfa_scope', p.get('mfa_scope') || 'openid profile email')
            sessionStorage.setItem('mfa_mode', p.get('mfa_mode') || '')
          }
          window.history.replaceState({}, '', '/verify')
          window.location.reload()
          return
        }
      }
      navigate('/login')
      return
    }
    refs.current[0]?.focus()
    if (isEmailVerify) startCooldown(60)
    return () => clearInterval(cooldownRef.current)
  }, [])

  const code = digits.join('')

  const onDigitChange = (i, val) => {
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 6)
      const next = Array(6).fill('')
      for (let j = 0; j < cleaned.length; j++) next[j] = cleaned[j]
      setDigits(next)
      refs.current[Math.min(cleaned.length, 5)]?.focus()
      return
    }
    const digit = val.replace(/\D/g, '')
    const next = [...digits]
    next[i] = digit
    setDigits(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }

  const onKeyDown = (i, e) => {
    if (e.key === 'Backspace') {
      if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n) }
      else if (i > 0) refs.current[i - 1]?.focus()
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
    else if (e.key === 'Enter' && code.length === 6) onVerify()
  }

  const clearSession = () => {
    ['mfa_email', 'mfa_verify_type', 'mfa_site_id', 'mfa_redirect_url', 'mfa_site_state', 'mfa_oidc', 'mfa_client_id', 'mfa_redirect_uri', 'mfa_state', 'mfa_scope', 'mfa_mode']
      .forEach((k) => sessionStorage.removeItem(k))
  }

  const continueOIDCConsent = async (accessToken) => {
    if (!mfaOIDC || !mfaClientID || !mfaRedirectURI) return false
    const resp = await fetch('/api/auth/check-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        client_id: mfaClientID,
        redirect_uri: mfaRedirectURI,
        state: mfaState,
        scope: mfaScope || 'openid profile email',
        mode: mfaMode,
      }),
    })
    const payload = await resp.json().catch(() => null)
    if (!resp.ok || !payload?.consent_url) {
      throw new Error(payload?.error || 'Failed to open consent page')
    }
    clearSession()
    window.location.replace(payload.consent_url)
    return true
  }

  const onVerify = async () => {
    if (code.length < 6 || loading) return
    setLoading(true)
    setError('')
    try {
      if (isEmailVerify) {
        const data = await verifyEmailCode(email, code)
        clearSession()
        if (data.access_token) {
          setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
          navigate('/setup')
        } else {
          navigate('/login?verified=1')
        }
      } else if (verifyType === 'totp') {
        const data = await totpLoginVerify(email, code, siteId, redirectUrl, siteState)
        setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
        if (await continueOIDCConsent(data.access_token)) return
        clearSession()
        const sid = data.site_id || siteId
        const rurl = data.redirect_url || redirectUrl
        const ss = data.site_state || siteState
        if (sid && rurl) {
          window.location.href = `/api/service/callback?site_id=${encodeURIComponent(sid)}&redirect_url=${encodeURIComponent(rurl)}&state=${encodeURIComponent(ss)}&token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token || '')}`
          return
        }
        navigate('/dashboard')
      } else {
        const data = await mfaVerify(email, code)
        setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
        if (await continueOIDCConsent(data.access_token)) return
        clearSession()
        const sid = data.site_id || siteId
        const rurl = data.redirect_url || redirectUrl
        const ss = data.site_state || siteState
        if (sid && rurl) {
          window.location.href = `/api/service/callback?site_id=${encodeURIComponent(sid)}&redirect_url=${encodeURIComponent(rurl)}&state=${encodeURIComponent(ss)}&token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token || '')}`
          return
        }
        navigate('/dashboard')
      }
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Invalid code')
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const onResend = async () => {
    if (loading || resendCooldown > 0) return
    setLoading(true)
    setError('')
    setInfo('')
    try {
      await resendVerifyEmail(email)
      setInfo('Code sent — check your inbox.')
      startCooldown(60)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to resend')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Box sx={{ position: 'fixed', top: 16, right: 16 }}>
          <ThemeToggle />
        </Box>
        <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 3, sm: 4 } }}>
          <Stack spacing={3}>

            <Link component={RouterLink} to="/login" underline="none" sx={{ color: 'text.secondary', fontSize: '0.875rem', width: 'fit-content' }}>
              ← Back
            </Link>

            <Stack spacing={0.75}>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                {isEmailVerify ? 'Verify your email' : verifyType === 'totp' ? 'Authenticator code' : 'Check your email'}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isEmailVerify
                  ? 'Enter the 6-digit code we sent to'
                  : verifyType === 'totp'
                  ? 'Enter the 6-digit code from your authenticator app'
                  : 'Enter the 6-digit login code we sent to'}
              </Typography>
              {verifyType !== 'totp' && (
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{email}</Typography>
              )}
            </Stack>

            {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
            {info && <Alert severity="success" sx={{ py: 0.5 }}>{info}</Alert>}

            {/* 6 digit boxes */}
            <Stack direction="row" spacing={1} justifyContent="center">
              {digits.map((d, i) => (
                <Box
                  key={i}
                  component="input"
                  ref={(el) => (refs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={d}
                  onChange={(e) => onDigitChange(i, e.target.value)}
                  onKeyDown={(e) => onKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                  sx={{
                    width: 48, height: 56,
                    border: '1px solid',
                    borderColor: d ? 'text.primary' : 'divider',
                    borderRadius: 1.5,
                    fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
                    outline: 'none',
                    bgcolor: 'background.paper',
                    color: 'text.primary',
                    fontFamily: 'inherit', cursor: 'text',
                    transition: 'border-color 0.15s',
                    '&:focus': { borderColor: 'text.primary', boxShadow: '0 0 0 2px rgba(128,128,128,0.15)' }
                  }}
                />
              ))}
            </Stack>

            <Button variant="contained" fullWidth disabled={code.length < 6 || loading} onClick={onVerify} sx={{ height: 44 }}>
              {loading ? 'Verifying...' : 'Continue'}
            </Button>

            {verifyType !== 'totp' && (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
              Didn't get the code?{' '}
              <Box
                component="span"
                onClick={onResend}
                sx={{
                  color: resendCooldown > 0 ? 'text.disabled' : 'text.primary',
                  fontWeight: 500,
                  cursor: resendCooldown > 0 || loading ? 'default' : 'pointer',
                  textDecoration: resendCooldown === 0 ? 'underline' : 'none',
                  textDecorationColor: 'transparent',
                  '&:hover': resendCooldown === 0 ? { textDecorationColor: 'currentColor' } : {}
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend'}
              </Box>
            </Typography>
            )}

          </Stack>
        </Box>
      </Container>
    </Box>
  )
}
