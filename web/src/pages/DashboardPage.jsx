import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, TextField, Divider,
  List, ListItem, ListItemText, Avatar, Chip, Alert, Collapse,
  Drawer, useMediaQuery, useTheme, IconButton
} from '@mui/material'
import { clearTokens, getAccessToken } from '../api/client'
import ThemeToggle from '../components/ThemeToggle.jsx'
import TOTPSection from '../components/TOTPSection.jsx'
import EmailMFASection from '../components/EmailMFASection.jsx'
import AvatarPickerDialog from '../components/AvatarPickerDialog.jsx'
import SessionsSection from '../components/SessionsSection.jsx'
import {
  getProfile, getProviders, unlinkProvider, setPassword,
  getServices, connectService, disconnectService,
  listServiceApps, createServiceApp, revokeServiceApp, deleteServiceApp, getMySites
} from '../api/endpoints'

// Nav SVG icons
const Icons = {
  profile: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  ),
  security: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>
  ),
  services: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  sites: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  developer: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>
  ),
}

const NAV = [
  { id: 'profile', label: 'Profile' },
  { id: 'security', label: 'Security' },
  { id: 'services', label: 'Services' },
  { id: 'sites', label: 'My Sites' },
  { id: 'developer', label: 'Developer' }
]

// Neutral avatar bg that works in both themes
const AVATAR_SX = { width: 32, height: 32, fontSize: '0.75rem' }
const AVATAR_LG_SX = { width: 56, height: 56, fontSize: '1.25rem' }

function UserAvatar({ src, name, sx = {} }) {
  return (
    <Avatar
      src={src || ''}
      imgProps={{ referrerPolicy: 'no-referrer', crossOrigin: 'anonymous' }}
      sx={{ bgcolor: 'action.selected', color: 'text.primary', ...sx }}
    >
      {!src && (name || '?')[0].toUpperCase()}
    </Avatar>
  )
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}

function SidebarContent({ profile, active, onNav, onLogout, onAdmin, onRegisterSite, onDocs, onClose }) {
  const role = (profile?.role || 'user').toLowerCase()
  const isDev = ['developer', 'admin', 'moderator'].includes(role)
  const isAdmin = ['admin', 'moderator'].includes(role)

  const navBtn = (onClick, label, isActive = false) => ({
    onClick: () => { onClick(); onClose?.() },
    sx: {
      justifyContent: 'flex-start', px: 1.5, py: 0.75, borderRadius: 1.5,
      fontSize: '0.875rem', fontWeight: isActive ? 600 : 400,
      color: isActive ? 'text.primary' : 'text.secondary',
      bgcolor: isActive ? 'action.selected' : 'transparent',
      '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
    }
  })

  return (
    <Box sx={{ width: 220, display: 'flex', flexDirection: 'column', p: 2, height: '100%' }}>
      <Box sx={{ px: 1, py: 1.5, mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>Neo ID</Typography>
      </Box>

      {profile && (
        <Box sx={{ px: 1, py: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <UserAvatar src={profile.avatar} name={profile.display_name || profile.email} sx={AVATAR_SX} />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                {profile.display_name || profile.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>{profile.role || 'User'}</Typography>
            </Box>
          </Stack>
        </Box>
      )}

      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {NAV.filter(n => {
          if (n.id === 'sites' && !isDev) return false
          if (n.id === 'developer' && !isDev) return false
          return true
        }).map(n => (
          <Button key={n.id} {...navBtn(() => onNav(n.id), n.label, active === n.id)}>
            <Box component="span" sx={{ mr: 1.25, display: 'flex', alignItems: 'center', opacity: active === n.id ? 1 : 0.6 }}>
              {Icons[n.id]}
            </Box>
            {n.label}
          </Button>
        ))}
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 2 }}>
        <Box sx={{ pb: 1 }}><ThemeToggle /></Box>
        {isDev && <Button {...navBtn(() => onRegisterSite(), 'Register Site')}>Register Site</Button>}
        {isDev && <Button {...navBtn(() => onDocs?.(), 'Docs')}>Docs</Button>}
        {isAdmin && <Button {...navBtn(() => onAdmin(), 'Admin Panel')}>Admin Panel</Button>}
        <Button onClick={onLogout} sx={{ justifyContent: 'flex-start', px: 1.5, py: 0.75, borderRadius: 1.5, fontSize: '0.875rem', color: 'error.main', '&:hover': { bgcolor: 'error.main', color: '#fff', opacity: 0.9 } }}>
          Sign out
        </Button>
      </Stack>
    </Box>
  )
}

function Sidebar({ profile, active, onNav, onLogout, onAdmin, onRegisterSite, onDocs }) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)

  if (isMobile) {
    return (
      <>
        {/* Mobile top bar */}
        <Box sx={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider',
          px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>Neo ID</Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ThemeToggle />
            <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Box>
        <Drawer
          anchor="left"
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          PaperProps={{ sx: { bgcolor: 'background.paper', width: 240 } }}
        >
          <SidebarContent
            profile={profile} active={active} onNav={onNav}
            onLogout={onLogout} onAdmin={onAdmin} onRegisterSite={onRegisterSite}
            onDocs={onDocs}
            onClose={() => setDrawerOpen(false)}
          />
        </Drawer>
      </>
    )
  }

  return (
    <Box sx={{ width: 220, flexShrink: 0, bgcolor: 'background.paper', borderRight: '1px solid', borderColor: 'divider', position: 'sticky', top: 0, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      <SidebarContent
        profile={profile} active={active} onNav={onNav}
        onLogout={onLogout} onAdmin={onAdmin} onRegisterSite={onRegisterSite}
        onDocs={onDocs}
      />
    </Box>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
    </Box>
  )
}

function Field({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{value || '—'}</Typography>
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

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')
  const [profile, setProfile] = useState(null)
  const [providers, setProviders] = useState([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState({ connected_services: [], available_services: [] })
  const [mySites, setMySites] = useState([])
  const [serviceApps, setServiceApps] = useState([])
  const [newServiceAppName, setNewServiceAppName] = useState('')
  const [issuedToken, setIssuedToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [pwdMfaStep, setPwdMfaStep] = useState(null) // null | 'totp' | 'email'
  const [pwdMfaCode, setPwdMfaCode] = useState('')
  const [pwdMfaLoading, setPwdMfaLoading] = useState(false)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)
  const token = getAccessToken()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  useEffect(() => { if (!token) navigate('/login') }, [token, navigate])

  const load = async () => {
    const p = await getProfile()
    setProfile(p)
    const pr = await getProviders()
    setProviders(pr.oauth_providers || [])
    setHasPassword(!!pr.has_password)
    const s = await getServices()
    setServices(s)
    const role = (p.role || '').toLowerCase()
    if (['developer', 'admin', 'moderator'].includes(role)) {
      const apps = await listServiceApps()
      setServiceApps(apps.service_apps || [])
      const sitesRes = await getMySites()
      setMySites(sitesRes.sites || [])
    }
  }

  useEffect(() => { load().catch(() => navigate('/login')) }, [])

  const notify = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const logout = () => { clearTokens(); navigate('/login') }
  const linkProvider = (p) => { window.location.href = `/api/auth/login/${p}?link=1&token=${encodeURIComponent(getAccessToken())}` }

  const onUnlink = async (p) => {
    try { await unlinkProvider(p); clearTokens(); navigate('/login') }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }
  const onSetPassword = async (mfaCode) => {
    if (newPassword !== confirmPassword) { notify('error', 'Passwords do not match'); return }
    if (newPassword.length < 8) { notify('error', 'Password must be at least 8 characters'); return }
    try {
      await setPassword(newPassword, currentPassword, mfaCode)
      setNewPassword(''); setConfirmPassword(''); setCurrentPassword('')
      setPwdMfaStep(null); setPwdMfaCode('')
      notify('success', 'Password updated')
      await load()
    } catch (e) {
      const msg = e?.response?.data?.error || 'Failed'
      const mfaType = e?.response?.data?.mfa_type
      if (msg === 'mfa_required' || mfaType) {
        setPwdMfaStep(mfaType || 'totp')
        return
      }
      notify('error', msg)
    }
  }

  const onPwdMfaSubmit = async () => {
    setPwdMfaLoading(true)
    try { await onSetPassword(pwdMfaCode) }
    finally { setPwdMfaLoading(false) }
  }
  const onConnectService = async (n) => { try { await connectService(n); await load() } catch (e) { notify('error', e?.response?.data?.error || 'Failed') } }
  const onDisconnectService = async (n) => { try { await disconnectService(n); await load() } catch (e) { notify('error', e?.response?.data?.error || 'Failed') } }
  const onCreateServiceApp = async () => {
    try { const d = await createServiceApp(newServiceAppName); setIssuedToken(d.token || ''); setNewServiceAppName(''); await load() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }
  const onRevokeServiceApp = async (id) => { try { await revokeServiceApp(id); await load() } catch (e) { notify('error', e?.response?.data?.error || 'Failed') } }
  const onDeleteServiceApp = async (id) => { try { await deleteServiceApp(id); await load() } catch (e) { notify('error', e?.response?.data?.error || 'Failed') } }
  const onDeleteSite = async (siteId) => {
    if (!window.confirm('Delete this site?')) return
    try {
      const res = await fetch('/api/site/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ site_id: siteId }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      notify('success', 'Site deleted'); await load()
    } catch (e) { notify('error', e?.message || 'Failed') }
  }

  const rowBorder = { borderBottom: '1px solid', borderColor: 'divider' }

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      <Sidebar profile={profile} active={activeSection} onNav={setActiveSection} onLogout={logout} onAdmin={() => navigate('/admin')} onRegisterSite={() => navigate('/register')} onDocs={() => navigate('/docs')} />

      <Box sx={{ flex: 1, p: { xs: 2, md: 4 }, maxWidth: 720, pt: { xs: 9, md: 4 } }}>
        <Collapse in={!!msg.text}>
          <Alert severity={msg.type || 'info'} sx={{ mb: 3, py: 0.5 }}>{msg.text}</Alert>
        </Collapse>

        {activeSection === 'profile' && (
          <Box>
            <SectionHeader title="Profile" subtitle="Your account information" />
            <Card>
              <Stack spacing={3}>
                <Stack direction="row" spacing={2} alignItems="center">
                  <Box sx={{ position: 'relative', display: 'inline-flex', cursor: 'pointer', flexShrink: 0 }} onClick={() => setAvatarDialogOpen(true)}>
                    <UserAvatar src={profile?.avatar} name={profile?.display_name || profile?.email} sx={AVATAR_LG_SX} />
                    <Box sx={{
                      position: 'absolute', inset: 0, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      bgcolor: 'rgba(0,0,0,0.35)', opacity: 0, transition: 'opacity 0.15s',
                      '&:hover': { opacity: 1 }
                    }}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                        <circle cx="12" cy="13" r="4"/>
                      </svg>
                    </Box>
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>{profile?.display_name}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>{profile?.email}</Typography>
                  </Box>
                </Stack>
                <Divider />
                <Stack spacing={2.5}>
                  <Field label="Email" value={profile?.email} />
                  <Field label="Display name" value={profile?.display_name} />
                  <Field label="Role" value={profile?.role || 'User'} />
                  <Field label="Unified ID" value={profile?.unified_id} />
                </Stack>
              </Stack>
            </Card>

            <AvatarPickerDialog
              open={avatarDialogOpen}
              currentAvatar={profile?.avatar}
              displayName={profile?.display_name || profile?.email}
              onClose={() => setAvatarDialogOpen(false)}
              onSaved={(newUrl) => {
                setProfile((p) => ({ ...p, avatar: newUrl }))
                notify('success', 'Profile picture updated')
              }}
            />
          </Box>
        )}

        {activeSection === 'security' && (
          <Box>
            <SectionHeader title="Security" subtitle="Manage login methods and password" />
            <Stack spacing={2}>
              <Card>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Linked accounts</Typography>
                <Stack spacing={1} sx={{ mb: 2 }}>
                  {providers.length === 0 && <Typography variant="body2" color="text.secondary">No linked providers</Typography>}
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
                  <Button variant="outlined" size="small" onClick={() => linkProvider('google')}
                    startIcon={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                      </svg>
                    }
                  >
                    Link Google
                  </Button>
                  <Button variant="outlined" size="small" onClick={() => linkProvider('github')}
                    startIcon={
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2z"/>
                      </svg>
                    }
                  >
                    Link GitHub
                  </Button>
                </Stack>
              </Card>
              <TOTPSection totpEnabled={profile?.totp_enabled} />
              <EmailMFASection emailMfaEnabled={profile?.email_mfa_enabled} />
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
              </Card>            </Stack>
          </Box>
        )}

        {activeSection === 'services' && (
          <Box>
            <SectionHeader title="Services" subtitle="Apps connected to your Neo ID account" />
            <Stack spacing={2}>
              <Card>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Connected</Typography>
                {(services.connected_services || []).length === 0
                  ? <Typography variant="body2" color="text.secondary">No services connected</Typography>
                  : <List dense disablePadding>
                    {(services.connected_services || []).map((s) => (
                      <ListItem key={s.name} disablePadding sx={{ py: 0.75, ...rowBorder }} secondaryAction={<Button size="small" color="error" onClick={() => onDisconnectService(s.name)} sx={{ fontSize: '0.75rem' }}>Disconnect</Button>}>
                        <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{s.display_name || s.name}</Typography>} secondary={<Typography variant="caption" color="text.secondary">{s.description}</Typography>} />
                      </ListItem>
                    ))}
                  </List>
                }
              </Card>
              {(services.available_services || []).length > 0 && (
                <Card>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Available</Typography>
                  <List dense disablePadding>
                    {(services.available_services || []).map((s) => (
                      <ListItem key={s.name} disablePadding sx={{ py: 0.75, ...rowBorder }} secondaryAction={<Button size="small" variant="outlined" onClick={() => onConnectService(s.name)} sx={{ fontSize: '0.75rem' }}>Connect</Button>}>
                        <ListItemText primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{s.display_name || s.name}</Typography>} secondary={<Typography variant="caption" color="text.secondary">{s.description}</Typography>} />
                      </ListItem>
                    ))}
                  </List>
                </Card>
              )}
            </Stack>
          </Box>
        )}

        {activeSection === 'sites' && (
          <Box>
            <SectionHeader title="My Sites" subtitle="Sites registered with Neo ID" />
            <Card>
              {mySites.length === 0
                ? <Stack spacing={1} alignItems="flex-start"><Typography variant="body2" color="text.secondary">No sites yet</Typography><Button variant="outlined" size="small" onClick={() => navigate('/register')}>Register a site</Button></Stack>
                : <Stack>{mySites.map((s, i) => (
                  <Box key={s.site_id} sx={{ py: 2, ...(i < mySites.length - 1 ? rowBorder : {}) }}>
                    <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{s.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{s.domain}</Typography>
                        <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                          <Chip label={s.plan} size="small" sx={{ fontSize: '0.7rem', height: 20, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider' }} />
                        </Stack>
                        <Box sx={{ mt: 1.5, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.25 }}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all' }}>
                            <Box component="span" sx={{ fontWeight: 500, mr: 0.5 }}>site_id</Box>
                            <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{s.site_id}</Box>
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', wordBreak: 'break-all', mt: 0.5 }}>
                            <Box component="span" sx={{ fontWeight: 500, mr: 0.5 }}>api_key</Box>
                            <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.72rem' }}>{s.api_key}</Box>
                          </Typography>
                        </Box>
                      </Box>
                      <Button size="small" color="error" onClick={() => onDeleteSite(s.site_id)} sx={{ fontSize: '0.75rem', flexShrink: 0 }}>Delete</Button>
                    </Stack>
                  </Box>
                ))}</Stack>
              }
            </Card>
          </Box>
        )}

        {activeSection === 'developer' && (
          <Box>
            <SectionHeader title="Developer" subtitle="Service tokens for API access" />
            <Card>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1.5} alignItems="flex-end">
                  <TextField label="App name" size="small" value={newServiceAppName} onChange={(e) => setNewServiceAppName(e.target.value)} sx={{ flex: 1 }} />
                  <Button variant="contained" size="small" onClick={onCreateServiceApp} disabled={!newServiceAppName} sx={{ height: 40, px: 2, flexShrink: 0 }}>Create</Button>
                </Stack>
                {issuedToken && (
                  <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>Token (copy now — shown once)</Typography>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{issuedToken}</Typography>
                  </Box>
                )}
                <Divider />
                {serviceApps.length === 0
                  ? <Typography variant="body2" color="text.secondary">No service apps yet</Typography>
                  : <Stack>{serviceApps.map((a, i) => (
                    <Box key={a.id} sx={{ py: 1.5, ...(i < serviceApps.length - 1 ? rowBorder : {}), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.name}</Typography>
                        <Typography variant="caption" color="text.secondary">{a.token_prefix}...{a.revoked_at ? ' · revoked' : ''}</Typography>
                      </Box>
                      <Stack direction="row" spacing={0.5}>
                        {!a.revoked_at && <Button size="small" color="error" onClick={() => onRevokeServiceApp(a.id)} sx={{ fontSize: '0.75rem' }}>Revoke</Button>}
                        <Button size="small" color="error" onClick={() => onDeleteServiceApp(a.id)} sx={{ fontSize: '0.75rem' }}>Delete</Button>
                      </Stack>
                    </Box>
                  ))}</Stack>
                }
              </Stack>
            </Card>
          </Box>
        )}
      </Box>
    </Box>
  )
}
