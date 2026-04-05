import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, TextField, Alert,
  Drawer, IconButton, useMediaQuery, useTheme
} from '@mui/material'
import { getProfile, registerSite } from '../api/endpoints'
import ThemeToggle from '../components/ThemeToggle.jsx'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <Button size="small" variant="outlined" onClick={copy} sx={{ fontSize: '0.72rem', height: 26, px: 1.25, flexShrink: 0 }}>
      {copied ? '✓ Copied' : 'Copy'}
    </Button>
  )
}

function CodeField({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em', fontSize: '0.68rem' }}>
        {label}
      </Typography>
      <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, fontSize: '0.8rem' }}>
          {value}
        </Typography>
        <CopyButton value={value} />
      </Box>
    </Box>
  )
}

export default function RegisterSitePage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [form, setForm] = useState({ name: '', domain: '', description: '', logo_url: '', owner_email: '', webhook_url: '' })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    getProfile()
      .then((p) => {
        const role = (p.role || 'user').toLowerCase()
        const ok = ['developer', 'admin', 'moderator'].includes(role)
        setAllowed(ok)
        if (!ok) setError('Developer role required to register sites')
      })
      .catch(() => { setError('Unauthorized'); setAllowed(false) })
  }, [])

  const onChange = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      const data = await registerSite({ ...form, plan: 'free' })
      setResult(data)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to register')
    } finally {
      setLoading(false)
    }
  }

  const SidebarContent = () => (
    <Box sx={{ width: 220, display: 'flex', flexDirection: 'column', p: 2, height: '100%', bgcolor: 'background.paper' }}>
      <Box sx={{ px: 1, py: 1.5, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>Neo ID</Typography>
      </Box>
      <Stack spacing={0.5} sx={{ flex: 1 }}>
        <Button
          onClick={() => { navigate('/dashboard'); setDrawerOpen(false) }}
          sx={{ justifyContent: 'flex-start', px: 1.5, py: 0.75, borderRadius: 1.5, fontSize: '0.875rem', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover', color: 'text.primary' } }}
        >
          ← Dashboard
        </Button>
      </Stack>
      <Box sx={{ pb: 1 }}><ThemeToggle /></Box>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>Neo ID</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ThemeToggle />
            <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Box>
      )}

      {!isMobile && (
        <Box sx={{ width: 220, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', minHeight: '100vh' }}>
          <SidebarContent />
        </Box>
      )}

      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper', width: 240 } }}>
        <SidebarContent />
      </Drawer>

      {/* Main content */}
      <Box sx={{ flex: 1, p: { xs: 2, md: 5 }, pt: { xs: 9, md: 5 } }}>
        <Box sx={{ maxWidth: 560 }}>
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>Register Site</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Add a new site to use Neo ID authentication
            </Typography>
          </Box>

          {error && <Alert severity="error" sx={{ mb: 3, py: 0.5 }}>{error}</Alert>}

          {!result ? (
            <Stack spacing={3}>
              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Site details</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Site name"
                    size="small"
                    value={form.name}
                    onChange={onChange('name')}
                    disabled={!allowed}
                    placeholder="My App"
                  />
                  <TextField
                    label="Domain"
                    size="small"
                    value={form.domain}
                    onChange={onChange('domain')}
                    disabled={!allowed}
                    placeholder="neomovies.ru, www.neomovies.ru, api.neomovies.ru"
                    helperText="Comma-separated domains or custom scheme (e.g. myapp://)"
                  />
                  <TextField
                    label="Owner email"
                    size="small"
                    value={form.owner_email}
                    onChange={onChange('owner_email')}
                    disabled={!allowed}
                    placeholder="you@example.com"
                  />
                </Stack>
              </Box>

              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Optional</Typography>
                <Stack spacing={2}>
                  <TextField
                    label="Description"
                    size="small"
                    value={form.description}
                    onChange={onChange('description')}
                    disabled={!allowed}
                    placeholder="What does your app do?"
                  />
                  <TextField
                    label="Logo URL"
                    size="small"
                    value={form.logo_url}
                    onChange={onChange('logo_url')}
                    disabled={!allowed}
                    placeholder="https://example.com/logo.png"
                  />
                  <TextField
                    label="Webhook URL"
                    size="small"
                    value={form.webhook_url}
                    onChange={onChange('webhook_url')}
                    disabled={!allowed}
                    placeholder="https://example.com/api/webhooks/neo-id"
                    helperText="Called when a user disconnects your app from Neo ID"
                  />
                </Stack>
              </Box>

              <Button
                variant="contained"
                disabled={!allowed || !form.name || !form.domain || loading}
                onClick={onSubmit}
                sx={{ height: 44 }}
              >
                {loading ? 'Registering...' : 'Register site'}
              </Button>
            </Stack>
          ) : (
            <Stack spacing={3}>
              <Alert severity="success" sx={{ py: 0.5 }}>
                <strong>{result.site?.name || form.name}</strong> registered successfully
              </Alert>

              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Your credentials</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2.5 }}>
                  Save the API Secret now — it won't be shown again.
                </Typography>
                <Stack spacing={2}>
                  <CodeField label="Site ID" value={result.site?.site_id || result.site_id || ''} />
                  <CodeField label="API Key" value={result.site?.api_key || result.api_key || ''} />
                  <CodeField label="API Secret" value={result.site?.api_secret || result.api_secret || ''} />
                </Stack>
              </Box>

              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>Quick start</Typography>
                <Stack spacing={2}>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      1. Redirect users to login
                    </Typography>
                    <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem', display: 'block' }}>
                        {`GET /login?site_id=${result.site?.site_id || ''}&redirect_url=https://yourapp.com/callback&site_state=<state>`}
                      </Typography>
                    </Box>
                  </Box>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                      2. Verify token on your server
                    </Typography>
                    <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
                      <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', fontSize: '0.75rem', display: 'block', whiteSpace: 'pre-wrap' }}>
                        {`POST /api/site/verify\nAuthorization: Bearer <api_key>\n{ "token": "<user_token>" }`}
                      </Typography>
                    </Box>
                  </Box>
                </Stack>
              </Box>

              <Stack direction="row" spacing={1.5} flexWrap="wrap" gap={1}>
                <Button variant="outlined" size="small" onClick={() => navigate('/docs')}>
                  View docs
                </Button>
                <Button variant="outlined" size="small" onClick={() => { setResult(null); setForm({ name: '', domain: '', description: '', logo_url: '', owner_email: '', webhook_url: '' }) }}>
                  Register another
                </Button>
                <Button variant="text" size="small" onClick={() => navigate('/dashboard')} sx={{ color: 'text.secondary' }}>
                  Dashboard
                </Button>
              </Stack>
            </Stack>
          )}
        </Box>
      </Box>
    </Box>
  )
}
