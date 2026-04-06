import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Typography, Button, Alert, Link, useTheme } from '@mui/material'
import { Smartphone, Mail, ShieldCheck } from 'lucide-react'
import { totpVerifyEnable, totpDisable, toggleEmailMFA, sendMFACode } from '../api/endpoints'
import ThemeToggle from '../components/ThemeToggle.jsx'

// sessionStorage keys written by callers:
//   2fa_action   — 'totp_enable' | 'totp_disable' | 'email_enable' | 'email_disable'
//   2fa_back     — URL to go back to (default '/dashboard')
//   2fa_code_type — 'totp' | 'email' (which code to accept, for disable flows)

export default function TwoFAPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const action    = sessionStorage.getItem('2fa_action') || ''
  const back      = sessionStorage.getItem('2fa_back') || '/dashboard'
  const codeType  = sessionStorage.getItem('2fa_code_type') || 'totp'

  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [altType, setAltType] = useState(codeType) // can switch between totp/email
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const refs = useRef([])

  useEffect(() => {
    if (!action) { navigate(back); return }
    // For email flows — send code automatically on mount
    if (action === 'email_enable' || (action === 'email_disable' && altType === 'email')) {
      sendMFACode().catch(() => {})
    }
    refs.current[0]?.focus()
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
    ['2fa_action', '2fa_back', '2fa_code_type'].forEach(k => sessionStorage.removeItem(k))
  }

  const onVerify = async () => {
    if (code.length < 6 || loading) return
    setLoading(true)
    setError('')
    try {
      switch (action) {
        case 'totp_enable':
          await totpVerifyEnable(code)
          setSuccess('Authenticator app enabled')
          break
        case 'totp_disable':
          await totpDisable(code)
          setSuccess('Authenticator app disabled')
          break
        case 'email_enable':
          await toggleEmailMFA(true, code)
          setSuccess('Email MFA enabled')
          break
        case 'email_disable':
          await toggleEmailMFA(false, code)
          setSuccess('Email MFA disabled')
          break
        default:
          navigate(back)
          return
      }
      clearSession()
      setTimeout(() => navigate(back), 800)
    } catch (e) {
      setError(e?.response?.data?.error || 'Invalid code')
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const switchAlt = () => {
    const next = altType === 'totp' ? 'email' : 'totp'
    setAltType(next)
    sessionStorage.setItem('2fa_code_type', next)
    setDigits(['', '', '', '', '', ''])
    setError('')
    if (next === 'email') sendMFACode().catch(() => {})
    setTimeout(() => refs.current[0]?.focus(), 50)
  }

  // UI config per action
  const cfg = {
    totp_enable:   { icon: <Smartphone size={28} />, title: 'Confirm authenticator app', sub: 'Enter the 6-digit code from your authenticator app to enable 2FA', btn: 'Enable', btnColor: 'primary' },
    totp_disable:  { icon: <Smartphone size={28} />, title: 'Disable authenticator app', sub: altType === 'totp' ? 'Enter the code from your authenticator app to confirm' : 'Enter the 6-digit code sent to your email to confirm', btn: 'Disable', btnColor: 'error' },
    email_enable:  { icon: <Mail size={28} />,       title: 'Confirm email verification', sub: 'Enter the 6-digit code sent to your email to enable email MFA', btn: 'Enable', btnColor: 'primary' },
    email_disable: { icon: <Mail size={28} />,       title: 'Disable email verification', sub: altType === 'totp' ? 'Enter the code from your authenticator app to confirm' : 'Enter the 6-digit code sent to your email to confirm', btn: 'Disable', btnColor: 'error' },
  }[action] || { icon: <ShieldCheck size={28} />, title: '2FA verification', sub: 'Enter your 6-digit code', btn: 'Verify', btnColor: 'primary' }

  const canSwitch = (action === 'totp_disable' || action === 'email_disable') &&
    sessionStorage.getItem('2fa_has_both') === '1'

  const cardSx = {
    bgcolor: 'background.paper',
    border: '1px solid', borderColor: 'divider',
    borderRadius: 2,
    p: { xs: 3, sm: 4 },
    boxShadow: dark
      ? '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)'
      : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Box sx={{ position: 'fixed', top: 16, right: 16 }}><ThemeToggle /></Box>

        <Box sx={cardSx}>
          <Stack spacing={3}>

            {/* Back */}
            <Link component={RouterLink} to={back} underline="none"
              sx={{ color: 'text.secondary', fontSize: '0.875rem', width: 'fit-content' }}>
              ← Back
            </Link>

            {/* Icon + title */}
            <Stack spacing={1} alignItems="center" sx={{ textAlign: 'center' }}>
              <Box sx={{ color: 'text.primary', mb: 0.5 }}>{cfg.icon}</Box>
              <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                {cfg.title}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 300 }}>
                {cfg.sub}
              </Typography>
            </Stack>

            {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
            {success && <Alert severity="success" sx={{ py: 0.5 }}>{success}</Alert>}

            {/* 6 digit boxes */}
            <Stack direction="row" spacing={1} justifyContent="center">
              {digits.map((d, i) => (
                <Box
                  key={i}
                  component="input"
                  ref={el => (refs.current[i] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={d}
                  onChange={e => onDigitChange(i, e.target.value)}
                  onKeyDown={e => onKeyDown(i, e)}
                  onFocus={e => e.target.select()}
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
                    '&:focus': { borderColor: 'text.primary', boxShadow: '0 0 0 2px rgba(128,128,128,0.15)' },
                  }}
                />
              ))}
            </Stack>

            <Button
              variant="contained"
              fullWidth
              color={cfg.btnColor}
              disabled={code.length < 6 || loading || !!success}
              onClick={onVerify}
              sx={{ height: 44 }}
            >
              {loading ? 'Verifying...' : success ? '✓' : cfg.btn}
            </Button>

            {/* Switch code type */}
            {canSwitch && (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
                {altType === 'totp' ? "Don't have your authenticator?" : 'Prefer authenticator app?'}{' '}
                <Box component="span" onClick={switchAlt}
                  sx={{ color: 'text.primary', fontWeight: 500, cursor: 'pointer', textDecoration: 'underline' }}>
                  {altType === 'totp' ? 'Use email code' : 'Use authenticator code'}
                </Box>
              </Typography>
            )}

          </Stack>
        </Box>
      </Container>
    </Box>
  )
}
