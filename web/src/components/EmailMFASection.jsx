import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Stack, Typography, Alert } from '@mui/material'
import { toggleEmailMFA } from '../api/endpoints'

export default function EmailMFASection({ emailMfaEnabled: initialEnabled, totpEnabled }) {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(!!initialEnabled)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onToggle = async () => {
    if (enabled) {
      // Disabling — go to /2fa for code verification
      sessionStorage.setItem('2fa_action', 'email_disable')
      sessionStorage.setItem('2fa_back', '/dashboard')
      sessionStorage.setItem('2fa_code_type', totpEnabled ? 'totp' : 'email')
      if (totpEnabled) sessionStorage.setItem('2fa_has_both', '1')
      else sessionStorage.removeItem('2fa_has_both')
      navigate('/2fa')
    } else {
      // Enabling — go to /2fa to confirm with email code
      sessionStorage.setItem('2fa_action', 'email_enable')
      sessionStorage.setItem('2fa_back', '/dashboard')
      sessionStorage.setItem('2fa_code_type', 'email')
      sessionStorage.removeItem('2fa_has_both')
      navigate('/2fa')
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
      <Stack spacing={1.5}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Email verification on login</Typography>
            <Typography variant="caption" color="text.secondary">
              Require a one-time code sent to your email every time you sign in
            </Typography>
          </Box>

          <Box
            onClick={!loading ? onToggle : undefined}
            sx={{
              width: 44, height: 24, borderRadius: 12,
              bgcolor: enabled ? 'text.primary' : 'action.selected',
              border: '1px solid',
              borderColor: enabled ? 'text.primary' : 'divider',
              cursor: loading ? 'default' : 'pointer',
              position: 'relative', flexShrink: 0,
              transition: 'background-color 0.2s, border-color 0.2s',
              opacity: loading ? 0.6 : 1, ml: 2,
            }}
          >
            <Box sx={{
              position: 'absolute', top: 2,
              left: enabled ? 22 : 2,
              width: 18, height: 18, borderRadius: '50%',
              bgcolor: enabled ? 'background.paper' : 'text.secondary',
              transition: 'left 0.2s',
              boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </Box>
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

        {enabled && (
          <Typography variant="caption" color="text.secondary" sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, display: 'block' }}>
            A 6-digit code will be sent to your email each time you sign in with a password.
          </Typography>
        )}
      </Stack>
    </Box>
  )
}
