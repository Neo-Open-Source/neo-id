import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, Chip,
  Drawer, IconButton, useMediaQuery, useTheme, Select, MenuItem
} from '@mui/material'
import ThemeToggle from '../components/ThemeToggle.jsx'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}

const METHOD_COLORS = {
  GET: { bg: '#dbeafe', text: '#1d4ed8' },
  POST: { bg: '#dcfce7', text: '#15803d' },
  PUT: { bg: '#fef9c3', text: '#a16207' },
  DELETE: { bg: '#fee2e2', text: '#dc2626' },
}
const METHOD_COLORS_DARK = {
  GET: { bg: '#1e3a5f', text: '#93c5fd' },
  POST: { bg: '#14532d', text: '#86efac' },
  PUT: { bg: '#451a03', text: '#fcd34d' },
  DELETE: { bg: '#450a0a', text: '#fca5a5' },
}

function Code({ children, block = false }) {
  return (
    <Box
      component={block ? 'pre' : 'code'}
      sx={{
        fontFamily: '"JetBrains Mono", "Fira Code", monospace',
        fontSize: block ? '0.78rem' : '0.8rem',
        bgcolor: 'action.hover',
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: block ? 1.5 : 0.75,
        px: block ? 2 : 0.75,
        py: block ? 1.5 : 0.2,
        display: block ? 'block' : 'inline',
        whiteSpace: block ? 'pre-wrap' : 'normal',
        wordBreak: 'break-all',
        m: 0,
        lineHeight: block ? 1.7 : 'inherit'
      }}
    >
      {children}
    </Box>
  )
}

function Endpoint({ method, path, desc, children }) {
  const theme = useTheme()
  const dark = theme.palette.mode === 'dark'
  const colors = dark ? METHOD_COLORS_DARK[method] : METHOD_COLORS[method]
  return (
    <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: colors?.bg, flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: colors?.text, fontFamily: 'monospace' }}>
            {method}
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all', flex: 1 }}>
          {path}
        </Typography>
        {desc && (
          <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mt: -0.5 }}>
            {desc}
          </Typography>
        )}
      </Box>
      {children && (
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
          {children}
        </Box>
      )}
    </Box>
  )
}

function Section({ title, children }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 2, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        {title}
      </Typography>
      {children}
    </Box>
  )
}

function P({ children }) {
  return (
    <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>
      {children}
    </Typography>
  )
}

const SECTIONS = [
  { id: 'overview', label: 'Overview' },
  { id: 'quickstart', label: 'Quick start' },
  { id: 'auth', label: 'Auth' },
  { id: 'oidc', label: 'OpenID Connect' },
  { id: 'site', label: 'Site integration' },
  { id: 'user', label: 'User API' },
  { id: 'mfa', label: 'MFA / 2FA' },
  { id: 'sessions', label: 'Sessions' },
]

function Content({ active }) {
  return (
    <Box>
      {active === 'overview' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Neo ID API</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3, lineHeight: 1.7 }}>
            Unified identity and authentication service. Supports email/password, OAuth (Google, GitHub), OpenID Connect, MFA, and session management.
          </Typography>
          <Section title="Base URL">
            <Code block>{`https://your-domain.com`}</Code>
          </Section>
          <Section title="Authentication">
            <P>Most endpoints require a Bearer token:</P>
            <Code block>{`Authorization: Bearer <access_token>`}</Code>
            <P>Access tokens expire after 24 hours. Use the refresh token to get a new one automatically.</P>
          </Section>
          <Section title="Errors">
            <P>All errors return an <Code>error</Code> field with HTTP 4xx/5xx:</P>
            <Code block>{`{ "error": "description of what went wrong" }`}</Code>
          </Section>
        </Box>
      )}

      {active === 'quickstart' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>Quick start</Typography>
          <Section title="1. Register your site">
            <P>Go to Dashboard → Register Site. You'll receive a <Code>site_id</Code>, <Code>api_key</Code>, and <Code>api_secret</Code>.</P>
          </Section>
          <Section title="2. Redirect users to login">
            <Code block>{`GET /login?site_id=<site_id>&redirect_url=https://yourapp.com/callback&site_state=<random>`}</Code>
            <P>After login, Neo ID redirects back with tokens in the URL fragment:</P>
            <Code block>{`https://yourapp.com/callback#access_token=...&refresh_token=...`}</Code>
          </Section>
          <Section title="3. Verify the token on your server">
            <Code block>{`POST /api/site/verify
Authorization: Bearer <api_key>
Content-Type: application/json

{ "token": "<user_access_token>" }`}</Code>
            <P>Response:</P>
            <Code block>{`{
  "valid": true,
  "user": {
    "unified_id": "uid_...",
    "email": "user@example.com",
    "display_name": "Alice",
    "avatar": "https://..."
  }
}`}</Code>
          </Section>
          <Section title="4. OpenID Connect (optional)">
            <P>Neo ID supports standard OIDC. Discovery document:</P>
            <Code block>{`GET /.well-known/openid-configuration`}</Code>
          </Section>
        </Box>
      )}

      {active === 'auth' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>Authentication</Typography>

          <Endpoint method="POST" path="/api/auth/password/register" desc="Register with email + password">
            <Code block>{`{ "email": "user@example.com", "password": "..." }

// Response
{ "verification_sent": true }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/password/login" desc="Login with email + password">
            <Code block>{`{ "email": "user@example.com", "password": "..." }

// Success
{ "access_token": "...", "refresh_token": "..." }

// TOTP required
{ "totp_required": true, "email": "..." }

// Email MFA required
{ "mfa_required": true, "email": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/auth/login/:provider" desc="OAuth login — provider: google, github">
            <Code block>{`// Optional site context:
?site_id=...&redirect_url=...&site_state=...`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/refresh" desc="Refresh access token (rolling)">
            <Code block>{`{ "refresh_token": "..." }

// Response — new tokens, expiry extended
{ "access_token": "...", "refresh_token": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/logout" desc="Invalidate current session">
            <Code block>{`Authorization: Bearer <access_token>`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/verify-email/code" desc="Verify email with 6-digit code">
            <Code block>{`{ "email": "user@example.com", "code": "123456" }

// Response (auto-login after verification)
{ "verified": true, "access_token": "...", "refresh_token": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/verify-email/resend" desc="Resend verification email">
            <Code block>{`{ "email": "user@example.com" }`}</Code>
          </Endpoint>
        </Box>
      )}

      {active === 'oidc' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>OpenID Connect</Typography>
          <P>Neo ID implements standard OIDC Authorization Code flow with optional PKCE.</P>

          <Endpoint method="GET" path="/.well-known/openid-configuration" desc="Discovery document" />
          <Endpoint method="GET" path="/.well-known/jwks.json" desc="JSON Web Key Set" />

          <Endpoint method="GET" path="/oauth/authorize" desc="Authorization endpoint">
            <Code block>{`?client_id=<site_id>
&redirect_uri=https://yourapp.com/callback
&response_type=code
&scope=openid profile email
&state=<random>
&nonce=<random>
// PKCE (recommended):
&code_challenge=<S256_hash>
&code_challenge_method=S256`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/oauth/token" desc="Exchange code for tokens">
            <Code block>{`Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&client_id=<site_id>
&client_secret=<api_secret>
&redirect_uri=https://yourapp.com/callback

// Response
{
  "access_token": "...",
  "id_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/oauth/userinfo" desc="Get user claims">
            <Code block>{`Authorization: Bearer <access_token>

// Response
{
  "sub": "uid_...",
  "email": "user@example.com",
  "email_verified": true,
  "name": "Alice",
  "given_name": "Alice",
  "family_name": "Smith",
  "picture": "https://..."
}`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/oauth/revoke" desc="Revoke token (RFC 7009)">
            <Code block>{`token=<access_or_refresh_token>`}</Code>
          </Endpoint>
        </Box>
      )}

      {active === 'site' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>Site integration</Typography>

          <Endpoint method="POST" path="/api/site/register" desc="Register a new site (Developer+ role required)">
            <Code block>{`Authorization: Bearer <user_access_token>

{
  "name": "My App",
  "domain": "example.com",
  "owner_email": "you@example.com",
  "description": "Optional",
  "logo_url": "https://..."
}

// Response
{
  "site": {
    "site_id": "site_...",
    "api_key": "api_...",
    "api_secret": "secret_..."
  }
}`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/site/verify" desc="Verify a user token">
            <Code block>{`Authorization: Bearer <api_key>

{ "token": "<user_access_token>" }

// Response
{
  "valid": true,
  "user": {
    "unified_id": "uid_...",
    "email": "user@example.com",
    "display_name": "Alice",
    "avatar": "https://...",
    "first_name": "Alice",
    "last_name": "Smith"
  }
}`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/site/info" desc="Get site info">
            <Code block>{`Authorization: Bearer <api_key>`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/site/my" desc="List your registered sites">
            <Code block>{`Authorization: Bearer <user_access_token>`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/site/delete" desc="Delete a site">
            <Code block>{`Authorization: Bearer <user_access_token>
{ "site_id": "site_..." }`}</Code>
          </Endpoint>
        </Box>
      )}

      {active === 'user' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>User API</Typography>
          <P>All endpoints require <Code>Authorization: Bearer &lt;access_token&gt;</Code></P>

          <Endpoint method="GET" path="/api/user/profile" desc="Get current user profile" />

          <Endpoint method="PUT" path="/api/user/profile" desc="Update profile">
            <Code block>{`{ "display_name": "Alice", "first_name": "Alice", "last_name": "Smith", "bio": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/profile/complete" desc="Set name + avatar (after registration)">
            <Code block>{`{ "display_name": "Alice", "avatar_url": "/avatars/..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/avatar" desc="Upload avatar or set stock URL">
            <Code block>{`// Multipart upload: field name "avatar" (max 5MB)
// OR JSON: { "avatar_url": "/avatars/..." }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/user/providers" desc="List linked OAuth providers" />

          <Endpoint method="POST" path="/api/user/provider/unlink" desc="Unlink OAuth provider">
            <Code block>{`{ "provider": "google" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/password/set" desc="Set or change password">
            <Code block>{`{ "password": "new_password", "current_password": "old_password" }`}</Code>
          </Endpoint>
        </Box>
      )}

      {active === 'mfa' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>MFA / 2FA</Typography>

          <Section title="Email MFA">
            <P>When enabled, a 6-digit code is sent to the user's email on every login.</P>
            <Endpoint method="POST" path="/api/user/mfa/email/toggle" desc="Enable or disable email MFA">
              <Code block>{`{ "enabled": true }`}</Code>
            </Endpoint>
            <Endpoint method="POST" path="/api/auth/mfa/verify" desc="Verify email MFA code during login">
              <Code block>{`{ "email": "user@example.com", "code": "123456" }

// Response
{ "access_token": "...", "refresh_token": "..." }`}</Code>
            </Endpoint>
          </Section>

          <Section title="TOTP (Authenticator app)">
            <P>Standard TOTP (RFC 6238). Works with Google Authenticator, Authy, 1Password, etc.</P>
            <Endpoint method="POST" path="/api/user/mfa/totp/setup" desc="Generate secret + QR code">
              <Code block>{`// Response
{
  "secret": "BASE32SECRET",
  "qr_code": "data:image/png;base64,...",
  "otpauth": "otpauth://totp/Neo%20ID:user@example.com?secret=..."
}`}</Code>
            </Endpoint>
            <Endpoint method="POST" path="/api/user/mfa/totp/verify" desc="Confirm first code and enable TOTP">
              <Code block>{`{ "code": "123456" }`}</Code>
            </Endpoint>
            <Endpoint method="POST" path="/api/user/mfa/totp/disable" desc="Disable TOTP (requires current code)">
              <Code block>{`{ "code": "123456" }`}</Code>
            </Endpoint>
            <Endpoint method="POST" path="/api/auth/totp/verify" desc="Verify TOTP code during login">
              <Code block>{`{ "email": "user@example.com", "code": "123456" }

// Response
{ "access_token": "...", "refresh_token": "..." }`}</Code>
            </Endpoint>
          </Section>
        </Box>
      )}

      {active === 'sessions' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Sessions</Typography>
          <P>Access tokens expire after 24 hours. Refresh tokens are rolling — each use extends the expiry by the configured duration (1–9 months).</P>

          <Endpoint method="GET" path="/api/user/sessions" desc="List all active sessions">
            <Code block>{`// Response
{
  "sessions": [{
    "id": "...",
    "ip_address": "1.2.3.4",
    "country": "Russia",
    "city": "Moscow",
    "location": "Moscow, Russia",
    "user_agent": "Mozilla/5.0...",
    "created_at": "2026-01-01T00:00:00Z",
    "last_used_at": "2026-04-05T12:00:00Z",
    "refresh_expires_at": "2026-05-05T12:00:00Z",
    "refresh_duration_months": 1,
    "is_current": true
  }]
}`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/sessions/revoke" desc="Revoke a specific session">
            <Code block>{`{ "id": "<session_id>" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/sessions/refresh-duration" desc="Set refresh token duration (applies to all sessions)">
            <Code block>{`{ "months": 3 }  // 1, 3, 6, or 9`}</Code>
          </Endpoint>
        </Box>
      )}
    </Box>
  )
}

export default function DocsPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [active, setActive] = useState('overview')

  const nav = (id) => { setActive(id); setDrawerOpen(false) }

  const NavList = ({ onClose }) => (
    <Stack spacing={0.25}>
      <Button
        onClick={() => { navigate('/dashboard'); onClose?.() }}
        sx={{ justifyContent: 'flex-start', px: 1.5, py: 0.6, borderRadius: 1.5, fontSize: '0.8rem', color: 'text.secondary', '&:hover': { bgcolor: 'action.hover' } }}
      >
        ← Dashboard
      </Button>
      <Box sx={{ my: 1, height: '1px', bgcolor: 'divider' }} />
      {SECTIONS.map((s) => (
        <Button
          key={s.id}
          onClick={() => { nav(s.id); onClose?.() }}
          sx={{
            justifyContent: 'flex-start', px: 1.5, py: 0.6, borderRadius: 1.5, fontSize: '0.8rem',
            fontWeight: active === s.id ? 600 : 400,
            color: active === s.id ? 'text.primary' : 'text.secondary',
            bgcolor: active === s.id ? 'action.selected' : 'transparent',
            '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
          }}
        >
          {s.label}
        </Button>
      ))}
    </Stack>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <Box sx={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100, bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider', px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Docs</Typography>
            {/* Section picker on mobile */}
            <Select
              size="small"
              value={active}
              onChange={(e) => setActive(e.target.value)}
              sx={{ fontSize: '0.8rem', height: 30, minWidth: 130 }}
            >
              {SECTIONS.map((s) => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
            </Select>
          </Stack>
          <Stack direction="row" spacing={1} alignItems="center">
            <ThemeToggle />
            <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <Box sx={{ width: 200, flexShrink: 0, borderRight: '1px solid', borderColor: 'divider', minHeight: '100vh', position: 'sticky', top: 0, height: '100vh', overflowY: 'auto' }}>
          <Box sx={{ p: 2 }}>
            <Box sx={{ px: 1, py: 1.5, mb: 2 }}>
              <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>Neo ID</Typography>
              <Typography variant="caption" color="text.secondary">Documentation</Typography>
            </Box>
            <NavList />
            <Box sx={{ mt: 2 }}><ThemeToggle /></Box>
          </Box>
        </Box>
      )}

      {/* Mobile drawer */}
      <Drawer anchor="left" open={drawerOpen} onClose={() => setDrawerOpen(false)} PaperProps={{ sx: { bgcolor: 'background.paper', width: 220 } }}>
        <Box sx={{ p: 2 }}>
          <Box sx={{ px: 1, py: 1.5, mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Neo ID</Typography>
            <Typography variant="caption" color="text.secondary">Documentation</Typography>
          </Box>
          <NavList onClose={() => setDrawerOpen(false)} />
        </Box>
      </Drawer>

      {/* Content */}
      <Box sx={{ flex: 1, p: { xs: 2, md: 5 }, pt: { xs: 9, md: 5 }, maxWidth: 780, minWidth: 0 }}>
        <Content active={active} />
      </Box>
    </Box>
  )
}
