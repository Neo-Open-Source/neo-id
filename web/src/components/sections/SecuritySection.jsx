import { useState } from 'react'
import {
  Box, Stack, Typography, Button, TextField, Chip, Alert
} from '@mui/material'
import { getAccessToken } from '../../api/client'
import { setPassword } from '../../api/endpoints'
import TOTPSection from '../TOTPSection.jsx'
import EmailMFASection from '../EmailMFASection.jsx'
import SessionsSection from './SessionsSection.jsx'

const rowBorder = { borderBottom: '1px solid', borderColor: 'divider' }

function SectionHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
    </Box>
  )
}

function Card({ children, sx = {} }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, ...sx }}>
      {children}
    </Box>
  )
}

const GoogleIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
  </svg>
)

const GitHubIcon = (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
  </svg>
)

export default function SecuritySection({ profile, providers, hasPassword, notify, onUnlink, onPasswordChanged }) {
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [pwdMfaStep, setPwdMfaStep] = useState(null) // null | 'totp' | 'email'
  const [pwdMfaCode, setPwdMfaCode] = useState('')
  const [pwdMfaLoading, setPwdMfaLoading] = useState(false)

  const linkProvider = (p) => {
    window.location.href = `/api/auth/login/${p}?link=1&token=${encodeURIComponent(getAccessToken())}`
  }

  const onSetPassword = async (mfaCode) => {
    if (newPassword !== confirmPassword) { notify('error', 'Passwords do not match'); return }
    if (newPassword.length < 8) { notify('error', 'Password must be at least 8 characters'); return }
    try {
      await setPassword(newPassword, currentPassword, mfaCode)
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setPwdMfaStep(null)
      setPwdMfaCode('')
      notify('success', 'Password updated')
      onPasswordChanged?.()
    } catch (e) {
      const errMsg = e?.response?.data?.error || 'Failed'
      const mfaType = e?.response?.data?.mfa_type
      if (errMsg === 'mfa_required' || mfaType) {
        setPwdMfaStep(mfaType || 'totp')
        return
      }
      notify('error', errMsg)
    }
  }

  const onPwdMfaSubmit = async () => {
    setPwdMfaLoading(true)
    try { await onSetPassword(pwdMfaCode) }
    finally { setPwdMfaLoading(false) }
  }

  return (
    <Box>
      <SectionHeader title="Security" subtitle="Manage login methods and password" />
      <Stack spacing={2}>
        <Card>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Linked accounts</Typography>
          <Stack spacing={1} sx={{ mb: 2 }}>
            {providers.length === 0 && (
              <Typography variant="body2" color="text.secondary">No linked providers</Typography>
            )}
            {providers.map((p) => (
              <Box key={p.provider} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, ...rowBorder }}>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Chip label={p.provider} size="small" sx={{ textTransform: 'capitalize', bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }} />
                  <Typography variant="caption" color="text.secondary">{p.external_id}</Typography>
                </Stack>
                <Button size="small" color="error" onClick={() => onUnlink(p.provider)} sx={{ fontSize: '0.75rem' }}>Unlink</Button>
              </Box>
            ))}
          </Stack>
          <Stack direction="row" spacing={1}>
            <Button variant="outlined" size="small" onClick={() => linkProvider('google')} startIcon={GoogleIcon}>Link Google</Button>
            <Button variant="outlined" size="small" onClick={() => linkProvider('github')} startIcon={GitHubIcon}>Link GitHub</Button>
          </Stack>
        </Card>

        <TOTPSection totpEnabled={profile?.totp_enabled} emailMfaEnabled={profile?.email_mfa_enabled} />
        <EmailMFASection emailMfaEnabled={profile?.email_mfa_enabled} totpEnabled={profile?.totp_enabled} />
        <SessionsSection currentRefreshMonths={profile?.refresh_duration_months || 1} />

        <Card>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Password</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            {hasPassword ? 'Password login is enabled' : 'Set a password to enable email login'}
          </Typography>

          {pwdMfaStep ? (
            <Stack spacing={1.5}>
              <Alert severity="info" sx={{ py: 0.5 }}>
                {pwdMfaStep === 'totp'
                  ? 'Enter the code from your authenticator app to confirm'
                  : 'Enter the 6-digit code sent to your email to confirm'}
              </Alert>
              <TextField
                label={pwdMfaStep === 'totp' ? 'Authenticator code' : 'Email code'}
                size="small"
                value={pwdMfaCode}
                onChange={(e) => setPwdMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                inputProps={{ inputMode: 'numeric', maxLength: 6 }}
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && onPwdMfaSubmit()}
              />
              <Stack direction="row" spacing={1}>
                <Button variant="contained" size="small" disabled={pwdMfaLoading || pwdMfaCode.length < 6} onClick={onPwdMfaSubmit} sx={{ px: 2 }}>
                  Confirm
                </Button>
                <Button size="small" onClick={() => { setPwdMfaStep(null); setPwdMfaCode('') }} sx={{ color: 'text.secondary' }}>
                  Cancel
                </Button>
              </Stack>
              {profile?.totp_enabled && profile?.email_mfa_enabled && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ cursor: 'pointer', textDecoration: 'underline', width: 'fit-content' }}
                  onClick={() => { setPwdMfaStep(pwdMfaStep === 'totp' ? 'email' : 'totp'); setPwdMfaCode('') }}
                >
                  {pwdMfaStep === 'totp' ? 'Use email code instead' : 'Use authenticator app instead'}
                </Typography>
              )}
            </Stack>
          ) : (
            <Stack spacing={1.5}>
              {hasPassword && (
                <TextField
                  label="Current password"
                  size="small"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              )}
              <TextField
                label="New password"
                size="small"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <TextField
                label="Confirm new password"
                size="small"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                error={confirmPassword.length > 0 && newPassword !== confirmPassword}
                helperText={confirmPassword.length > 0 && newPassword !== confirmPassword ? "Passwords don't match" : ''}
                onKeyDown={(e) => e.key === 'Enter' && onSetPassword()}
              />
              <Button
                variant="contained"
                size="small"
                onClick={() => onSetPassword()}
                disabled={!newPassword || newPassword !== confirmPassword || (hasPassword && !currentPassword)}
                sx={{ alignSelf: 'flex-start', px: 2 }}
              >
                Save password
              </Button>
            </Stack>
          )}
        </Card>
      </Stack>
    </Box>
  )
}
