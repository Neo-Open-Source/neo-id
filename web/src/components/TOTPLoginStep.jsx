import { useRef, useState } from 'react'
import { Box, Stack, Typography, Button, Alert, Link } from '@mui/material'
import { totpLoginVerify } from '../api/endpoints'

export default function TOTPLoginStep({ email, siteId, redirectUrl, siteState, onBack, onSuccess }) {
  const [digits, setDigits] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const refs = useRef([])

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
    const next = [...digits]; next[i] = digit; setDigits(next)
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

  const onVerify = async () => {
    if (code.length < 6 || loading) return
    setLoading(true)
    setError('')
    try {
      const data = await totpLoginVerify(email, code, siteId, redirectUrl, siteState)
      await onSuccess(data)
    } catch (e) {
      setError(e?.response?.data?.error || 'Invalid code')
      setDigits(['', '', '', '', '', ''])
      refs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: { xs: 3, sm: 4 } }}>
      <Stack spacing={3}>
        <Link component="button" underline="none" onClick={onBack} sx={{ color: 'text.secondary', fontSize: '0.875rem', width: 'fit-content', textAlign: 'left' }}>
          ← Back
        </Link>

        <Stack spacing={0.75}>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>Two-factor authentication</Typography>
          <Typography variant="body2" color="text.secondary">Enter the 6-digit code from your authenticator app</Typography>
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

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
              autoFocus={i === 0}
              sx={{
                width: 48, height: 56,
                border: '1px solid', borderColor: d ? 'text.primary' : 'divider',
                borderRadius: 1.5, fontSize: '1.5rem', fontWeight: 700, textAlign: 'center',
                outline: 'none', bgcolor: 'background.paper', color: 'text.primary',
                fontFamily: 'inherit', cursor: 'text', transition: 'border-color 0.15s',
                '&:focus': { borderColor: 'text.primary', boxShadow: '0 0 0 2px rgba(128,128,128,0.15)' }
              }}
            />
          ))}
        </Stack>

        <Button variant="contained" fullWidth disabled={code.length < 6 || loading} onClick={onVerify} sx={{ height: 44 }}>
          {loading ? 'Verifying...' : 'Continue'}
        </Button>
      </Stack>
    </Box>
  )
}
