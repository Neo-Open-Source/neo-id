import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Container, Stack, Typography, Button, Avatar,
  Divider, CircularProgress, Alert, Chip, useTheme
} from '@mui/material'
import { Check, Mail, User } from 'lucide-react'
import ThemeToggle from '../components/ThemeToggle.jsx'

const SCOPES = {
  openid: { label: 'Your identity', icon: <User size={14} /> },
  profile: { label: 'Name and avatar', icon: <User size={14} /> },
  email: { label: 'Email address', icon: <Mail size={14} /> },
}

export default function ConsentPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'

  const params = new URLSearchParams(window.location.search)
  const sessionKey = params.get('session') || ''

  const [info, setInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionKey) { navigate('/login'); return }
    fetch(`/api/oauth/consent-info?session=${encodeURIComponent(sessionKey)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setInfo)
      .catch(() => setError('Session expired or invalid. Please try again.'))
      .finally(() => setLoading(false))
  }, [sessionKey, navigate])

  const respond = async (approved) => {
    setSubmitting(true)
    setError('')
    try {
      const accessToken = (() => {
        try { return localStorage.getItem('accessToken') || '' } catch { return '' }
      })()
      const resp = await fetch('/api/oauth/consent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ session: sessionKey, approved }),
      })
      const data = await resp.json()
      if (!resp.ok) { setError(data.error || 'Something went wrong'); return }

      if (data.popup && data.access_token) {
        // Popup mode — postMessage to opener then close
        const msg = {
          type: 'neo_id_auth',
          access_token: data.access_token,
          refresh_token: data.refresh_token || '',
          state: data.state || '',
        }
        if (window.opener) {
          window.opener.postMessage(msg, data.origin || '*')
          window.close()
        } else {
          window.location.replace(data.redirect)
        }
        return
      }

      if (data.redirect) {
        window.location.replace(data.redirect)
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const scopes = info?.scope
    ? info.scope.split(/[\s+]/).filter(s => SCOPES[s])
    : []

  const cardSx = {
    bgcolor: 'background.paper',
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: 2,
    p: { xs: 3, sm: 4 },
    boxShadow: dark
      ? '0 0 0 1px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.5)'
      : '0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)',
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', bgcolor: 'background.default' }}>
      <Container maxWidth="xs">
        <Box sx={{ position: 'fixed', top: 16, right: 16 }}>
          <ThemeToggle />
        </Box>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress size={32} />
          </Box>
        ) : error ? (
          <Box sx={cardSx}>
            <Alert severity="error">{error}</Alert>
            <Button fullWidth variant="outlined" sx={{ mt: 2 }} onClick={() => navigate('/login')}>
              Back to sign in
            </Button>
          </Box>
        ) : (
          <Box sx={cardSx}>
            <Stack spacing={3}>

              {/* Header */}
              <Stack spacing={0.5}>
                <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.5px' }}>
                  Allow access
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Review the permissions before continuing
                </Typography>
              </Stack>

              {/* Site info */}
              <Stack direction="row" spacing={1.5} alignItems="center"
                sx={{ p: 1.5, bgcolor: 'action.hover', borderRadius: 1.5, border: '1px solid', borderColor: 'divider' }}>
                {info?.site?.logo ? (
                  <Avatar src={info.site.logo} sx={{ width: 40, height: 40, borderRadius: 1 }} variant="rounded" />
                ) : (
                  <Avatar sx={{ width: 40, height: 40, borderRadius: 1, bgcolor: 'primary.main', color: 'primary.contrastText', fontWeight: 700, fontSize: '1rem' }} variant="rounded">
                    {(info?.site?.name || '?')[0].toUpperCase()}
                  </Avatar>
                )}
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {info?.site?.name || info?.site?.id}
                  </Typography>
                  {info?.site?.description && (
                    <Typography variant="caption" color="text.secondary">
                      {info.site.description}
                    </Typography>
                  )}
                </Box>
              </Stack>

              {/* Signed in as */}
              <Stack direction="row" spacing={1} alignItems="center">
                <Typography variant="caption" color="text.secondary">Signed in as</Typography>
                <Chip
                  size="small"
                  avatar={info?.user?.avatar
                    ? <Avatar src={info.user.avatar} imgProps={{ referrerPolicy: 'no-referrer' }} />
                    : <Avatar>{(info?.user?.name || info?.user?.email || '?')[0].toUpperCase()}</Avatar>
                  }
                  label={info?.user?.name || info?.user?.email}
                  sx={{ fontSize: '0.75rem', height: 24 }}
                />
              </Stack>

              <Divider />

              {/* Permissions */}
              <Stack spacing={1}>
                <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
                  This app will be able to access
                </Typography>
                {scopes.map(s => (
                  <Stack key={s} direction="row" spacing={1} alignItems="center">
                    <Check size={14} color={dark ? '#4ade80' : '#16a34a'} />
                    <Typography variant="body2">{SCOPES[s].label}</Typography>
                  </Stack>
                ))}
              </Stack>

              {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

              {/* Actions */}
              <Stack spacing={1}>
                <Button
                  variant="contained"
                  fullWidth
                  disabled={submitting}
                  onClick={() => respond(true)}
                  sx={{ height: 42 }}
                >
                  {submitting ? <CircularProgress size={18} /> : 'Allow'}
                </Button>
                <Button
                  variant="outlined"
                  fullWidth
                  disabled={submitting}
                  onClick={() => respond(false)}
                  sx={{ height: 42 }}
                >
                  Deny
                </Button>
              </Stack>

              <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                You can revoke access at any time from your Neo ID dashboard.
              </Typography>

            </Stack>
          </Box>
        )}
      </Container>
    </Box>
  )
}
