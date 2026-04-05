import { useRef, useState } from 'react'
import { Box, Stack, Typography, Button, Alert, TextField } from '@mui/material'
import { totpSetup, totpVerifyEnable, totpDisable } from '../api/endpoints'

export default function TOTPSection({ totpEnabled: initialEnabled }) {
  const [enabled, setEnabled] = useState(initialEnabled)
  const [step, setStep] = useState('idle') // idle | setup | disable
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const inputRef = useRef()

  const onStartSetup = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await totpSetup()
      setSetupData(data)
      setStep('setup')
      setTimeout(() => inputRef.current?.focus(), 100)
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to set up TOTP')
    } finally {
      setLoading(false)
    }
  }

  const onVerifyEnable = async () => {
    if (code.trim().length < 6) return
    setLoading(true)
    setError('')
    try {
      await totpVerifyEnable(code.trim())
      setEnabled(true)
      setStep('idle')
      setSetupData(null)
      setCode('')
      setSuccess('Authenticator app enabled')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError(e?.response?.data?.error || 'Invalid code')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const onDisable = async () => {
    if (code.trim().length < 6) return
    setLoading(true)
    setError('')
    try {
      await totpDisable(code.trim())
      setEnabled(false)
      setStep('idle')
      setCode('')
      setSuccess('Authenticator app disabled')
      setTimeout(() => setSuccess(''), 4000)
    } catch (e) {
      setError(e?.response?.data?.error || 'Invalid code')
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  const onCancel = () => { setStep('idle'); setCode(''); setError(''); setSetupData(null) }

  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
      <Stack spacing={2}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Authenticator app</Typography>
            <Typography variant="caption" color="text.secondary">
              {enabled ? 'Two-factor authentication is enabled' : 'Add an extra layer of security to your account'}
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.5, py: 0.5, borderRadius: 6, bgcolor: enabled ? 'success.main' : 'action.hover', border: '1px solid', borderColor: enabled ? 'success.main' : 'divider' }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: enabled ? '#fff' : 'text.disabled' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: enabled ? '#fff' : 'text.secondary', fontSize: '0.7rem' }}>
              {enabled ? 'ON' : 'OFF'}
            </Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ py: 0.5 }}>{success}</Alert>}

        {/* Idle state */}
        {step === 'idle' && !enabled && (
          <Button variant="outlined" size="small" onClick={onStartSetup} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
            {loading ? 'Setting up...' : 'Set up authenticator'}
          </Button>
        )}
        {step === 'idle' && enabled && (
          <Button variant="outlined" size="small" color="error" onClick={() => { setStep('disable'); setTimeout(() => inputRef.current?.focus(), 100) }} sx={{ alignSelf: 'flex-start' }}>
            Disable
          </Button>
        )}

        {/* Setup flow */}
        {step === 'setup' && setupData && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.)
            </Typography>

            {/* QR code */}
            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box
                component="img"
                src={setupData.qr_code}
                alt="TOTP QR Code"
                sx={{ width: 160, height: 160, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, bgcolor: '#fff' }}
              />
            </Box>

            {/* Manual key */}
            <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Manual entry key
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', letterSpacing: '0.1em', wordBreak: 'break-all' }}>
                {setupData.secret}
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary">
              After scanning, enter the 6-digit code from your app to confirm
            </Typography>

            <Stack direction="row" spacing={1.5} alignItems="flex-end">
              <TextField
                inputRef={inputRef}
                label="Verification code"
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                onKeyDown={(e) => e.key === 'Enter' && onVerifyEnable()}
                sx={{ flex: 1 }}
              />
              <Button variant="contained" size="small" disabled={loading || code.trim().length < 6} onClick={onVerifyEnable} sx={{ height: 40, px: 2, flexShrink: 0 }}>
                Confirm
              </Button>
            </Stack>

            <Button variant="text" size="small" onClick={onCancel} sx={{ color: 'text.secondary', alignSelf: 'flex-start' }}>
              Cancel
            </Button>
          </Stack>
        )}

        {/* Disable flow */}
        {step === 'disable' && (
          <Stack spacing={1.5}>
            <Typography variant="body2" color="text.secondary">
              Enter the code from your authenticator app to disable 2FA
            </Typography>
            <Stack direction="row" spacing={1.5} alignItems="flex-end">
              <TextField
                inputRef={inputRef}
                label="Authenticator code"
                size="small"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                onKeyDown={(e) => e.key === 'Enter' && onDisable()}
                sx={{ flex: 1 }}
              />
              <Button variant="contained" size="small" color="error" disabled={loading || code.trim().length < 6} onClick={onDisable} sx={{ height: 40, px: 2, flexShrink: 0 }}>
                Disable
              </Button>
            </Stack>
            <Button variant="text" size="small" onClick={onCancel} sx={{ color: 'text.secondary', alignSelf: 'flex-start' }}>
              Cancel
            </Button>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
