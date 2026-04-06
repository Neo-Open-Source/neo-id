import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Button, Alert, TextField } from '@mui/material'
import { totpSetup } from '../api/endpoints'

export default function TOTPSection({ totpEnabled: initialEnabled, emailMfaEnabled }) {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [step, setStep] = useState('idle') // idle | setup
  const [setupData, setSetupData] = useState(null)
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onStartSetup = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await totpSetup()
      setSetupData(data)
      setStep('setup')
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to set up TOTP')
    } finally {
      setLoading(false)
    }
  }

  const goTo2FA = (action) => {
    sessionStorage.setItem('2fa_action', action)
    sessionStorage.setItem('2fa_back', '/dashboard')
    sessionStorage.setItem('2fa_code_type', 'totp')
    if (emailMfaEnabled) sessionStorage.setItem('2fa_has_both', '1')
    else sessionStorage.removeItem('2fa_has_both')
    navigate('/2fa')
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
          <Box sx={{
            display: 'flex', alignItems: 'center', gap: 0.75,
            px: 1.5, py: 0.5, borderRadius: 6,
            bgcolor: enabled ? 'success.main' : 'action.hover',
            border: '1px solid', borderColor: enabled ? 'success.main' : 'divider',
          }}>
            <Box sx={{ width: 6, height: 6, borderRadius: '50%', bgcolor: enabled ? '#fff' : 'text.disabled' }} />
            <Typography variant="caption" sx={{ fontWeight: 600, color: enabled ? '#fff' : 'text.secondary', fontSize: '0.7rem' }}>
              {enabled ? 'ON' : 'OFF'}
            </Typography>
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

        {/* Idle */}
        {step === 'idle' && !enabled && (
          <Button variant="outlined" size="small" onClick={onStartSetup} disabled={loading} sx={{ alignSelf: 'flex-start' }}>
            {loading ? 'Setting up...' : 'Set up authenticator'}
          </Button>
        )}
        {step === 'idle' && enabled && (
          <Button variant="outlined" size="small" color="error" onClick={() => goTo2FA('totp_disable')} sx={{ alignSelf: 'flex-start' }}>
            Disable
          </Button>
        )}

        {/* Setup — show QR, then redirect to /2fa for code entry */}
        {step === 'setup' && setupData && (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              Scan this QR code with your authenticator app, then click Continue to enter the confirmation code.
            </Typography>

            <Box sx={{ display: 'flex', justifyContent: 'center' }}>
              <Box component="img" src={setupData.qr_code} alt="TOTP QR Code"
                sx={{ width: 160, height: 160, border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 1, bgcolor: '#fff' }} />
            </Box>

            <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                Manual entry key
              </Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', letterSpacing: '0.1em', wordBreak: 'break-all' }}>
                {setupData.secret}
              </Typography>
            </Box>

            <Stack direction="row" spacing={1}>
              <Button variant="contained" size="small" onClick={() => goTo2FA('totp_enable')} sx={{ px: 2 }}>
                Continue →
              </Button>
              <Button variant="text" size="small" onClick={onCancel} sx={{ color: 'text.secondary' }}>
                Cancel
              </Button>
            </Stack>
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
