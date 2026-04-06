import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Typography, useMediaQuery, useTheme, Select, MenuItem } from '@mui/material'
import AppLayout from '../components/AppLayout.jsx'

const MC = {
  GET:    { bg: '#dbeafe', text: '#1d4ed8' },
  POST:   { bg: '#dcfce7', text: '#15803d' },
  PUT:    { bg: '#fef9c3', text: '#a16207' },
  DELETE: { bg: '#fee2e2', text: '#dc2626' },
  PATCH:  { bg: '#f3e8ff', text: '#7c3aed' },
}
const MC_DARK = {
  GET:    { bg: '#1e3a5f', text: '#93c5fd' },
  POST:   { bg: '#14532d', text: '#86efac' },
  PUT:    { bg: '#451a03', text: '#fcd34d' },
  DELETE: { bg: '#450a0a', text: '#fca5a5' },
  PATCH:  { bg: '#2e1065', text: '#d8b4fe' },
}

function Code({ children, block = false }) {
  return (
    <Box component={block ? 'pre' : 'code'} sx={{
      fontFamily: '"JetBrains Mono","Fira Code",monospace',
      fontSize: block ? '0.78rem' : '0.8rem',
      bgcolor: 'action.hover',
      border: '1px solid', borderColor: 'divider',
      borderRadius: block ? 1.5 : 0.75,
      px: block ? 2 : 0.75, py: block ? 1.5 : 0.2,
      display: block ? 'block' : 'inline',
      whiteSpace: block ? 'pre-wrap' : 'normal',
      wordBreak: 'break-all', m: 0, lineHeight: block ? 1.7 : 'inherit',
    }}>
      {children}
    </Box>
  )
}

function Endpoint({ method, path, desc, children }) {
  const dark = useTheme().palette.mode === 'dark'
  const c = (dark ? MC_DARK : MC)[method] || MC.GET
  return (
    <Box sx={{ mb: 2, border: '1px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
      <Box sx={{ px: 2, py: 1.25, bgcolor: 'action.hover', display: 'flex', alignItems: 'flex-start', gap: 1.5, flexWrap: 'wrap' }}>
        <Box sx={{ px: 1, py: 0.25, borderRadius: 1, bgcolor: c.bg, flexShrink: 0 }}>
          <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: c.text, fontFamily: 'monospace' }}>{method}</Typography>
        </Box>
        <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all', flex: 1 }}>{path}</Typography>
        {desc && <Typography variant="caption" color="text.secondary" sx={{ width: '100%', mt: -0.5 }}>{desc}</Typography>}
      </Box>
      {children && (
        <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>{children}</Box>
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
  return <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5, lineHeight: 1.7 }}>{children}</Typography>
}

const SECTIONS = [
  { id: 'overview',    label: 'Overview' },
  { id: 'quickstart',  label: 'Quick start' },
  { id: 'consent',     label: 'Consent flow' },
  { id: 'oidc',        label: 'OpenID Connect' },
  { id: 'site',        label: 'Site integration' },
  { id: 'auth',        label: 'Auth API' },
  { id: 'user',        label: 'User API' },
  { id: 'mfa',         label: 'MFA / 2FA' },
  { id: 'sessions',    label: 'Sessions' },
  { id: 'webhooks',    label: 'Webhooks' },
]

function Content({ active }) {
  return (
    <Box>

      {/* ── OVERVIEW ── */}
      {active === 'overview' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Neo ID</Typography>
          <P>Unified identity and authentication service. Provides OAuth 2.0 / OpenID Connect, email/password auth, MFA, session management, and a SaaS site-integration API.</P>

          <Section title="Base URL">
            <Code block>https://id.neomovies.ru</Code>
          </Section>

          <Section title="Authentication">
            <P>Protected endpoints require a Bearer token:</P>
            <Code block>Authorization: Bearer &lt;access_token&gt;</Code>
            <P>Access tokens expire after 24 hours. Use <Code>/api/auth/refresh</Code> with a refresh token to rotate them.</P>
          </Section>

          <Section title="Error format">
            <Code block>{`{ "error": "description" }`}</Code>
          </Section>

          <Section title="Supported OAuth providers">
            <P>Google, GitHub, Yandex, VK</P>
          </Section>
        </Box>
      )}

      {/* ── QUICK START ── */}
      {active === 'quickstart' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>Quick start</Typography>

          <Section title="1. Register your site">
            <P>Dashboard → Services → New client. You'll receive:</P>
            <Code block>{`site_id   — your client_id
api_key   — used as Authorization header
api_secret — used as client_secret in OIDC token exchange`}</Code>
          </Section>

          <Section title="2. Get a login URL">
            <Code block>{`POST /api/service/login
Authorization: Bearer <api_key>

{
  "redirect_url": "https://yourapp.com/callback",
  "state": "<random>",
  "mode": "popup"   // or omit for redirect
}

// Response
{ "login_url": "/oauth/authorize?client_id=...&..." }`}</Code>
            <P>Redirect the user (or open a popup) to <Code>login_url</Code>.</P>
          </Section>

          <Section title="3. Consent page">
            <P>If the user is already signed in to Neo ID, they land on the consent page — no login form. They approve access and Neo ID redirects back with a code (or sends a postMessage in popup mode).</P>
          </Section>

          <Section title="4. Exchange code for tokens (OIDC)">
            <Code block>{`POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&client_id=<site_id>
&client_secret=<api_secret>
&redirect_uri=https://yourapp.com/callback

// Response
{
  "access_token": "...",
  "id_token": "...",       // RS256 JWT
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}`}</Code>
          </Section>

          <Section title="5. Verify token (simple flow)">
            <P>Alternatively, skip OIDC and verify the token directly:</P>
            <Code block>{`POST /api/service/verify
Authorization: Bearer <api_key>

{ "token": "<access_token>" }

// Response
{
  "valid": true,
  "user": {
    "unified_id": "uid_...",
    "email": "user@example.com",
    "display_name": "Alice",
    "avatar": "https://..."
  }
}`}</Code>
            <P>Use <Code>unified_id</Code> as the primary key in your database.</P>
          </Section>
        </Box>
      )}

      {/* ── CONSENT FLOW ── */}
      {active === 'consent' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Consent flow</Typography>
          <P>When a user opens the authorization popup and is already signed in to Neo ID, they skip the login form and land directly on the consent page.</P>

          <Section title="How it works">
            <P>1. <Code>GET /oauth/authorize?...</Code> — Neo ID detects an existing session via cookie (<Code>neo_id_token</Code>) or Authorization header.</P>
            <P>2. A short-lived consent session (10 min) is created and the user is redirected to <Code>/consent?session=&lt;key&gt;</Code>.</P>
            <P>3. The consent page fetches site + user info:</P>
            <Code block>{`GET /api/oauth/consent-info?session=<key>

// Response
{
  "site": { "id": "...", "name": "NeoMovies", "logo": "...", "description": "..." },
  "user": { "name": "Alice", "email": "...", "avatar": "..." },
  "scope": "openid profile email",
  "mode": "popup"
}`}</Code>
            <P>4. User clicks Allow or Deny:</P>
            <Code block>{`POST /api/oauth/consent
{ "session": "<key>", "approved": true }

// Redirect flow response
{ "redirect": "https://yourapp.com/callback?code=...&state=..." }

// Popup flow response
{
  "popup": true,
  "access_token": "...",
  "refresh_token": "...",
  "state": "...",
  "origin": "https://yourapp.com",
  "redirect": "https://yourapp.com/callback?code=...&state=..."
}`}</Code>
            <P>In popup mode the frontend sends a <Code>postMessage</Code> to the opener and closes the window.</P>
          </Section>

          <Section title="Session detection">
            <P>Neo ID reads the session from (in order):</P>
            <Code block>{`1. Authorization: Bearer <token>   (header)
2. Cookie: neo_id_token=<token>    (cross-subdomain, set on login)
3. ?token=<token>                  (query param, popup fallback)`}</Code>
          </Section>
        </Box>
      )}

      {/* ── OIDC ── */}
      {active === 'oidc' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>OpenID Connect</Typography>
          <P>Standard OIDC Authorization Code flow. ID tokens are signed with RS256. PKCE (S256) is supported.</P>

          <Endpoint method="GET" path="/.well-known/openid-configuration" desc="Discovery document — lists all endpoints and capabilities" />
          <Endpoint method="GET" path="/.well-known/jwks.json" desc="RSA public key for verifying RS256 id_token signatures" />

          <Endpoint method="GET" path="/oauth/authorize" desc="Start authorization — redirects to login or consent page">
            <Code block>{`?client_id=<site_id>
&redirect_uri=https://yourapp.com/callback
&response_type=code
&scope=openid profile email
&state=<random>
&nonce=<random>
// PKCE (recommended):
&code_challenge=<BASE64URL(SHA256(verifier))>
&code_challenge_method=S256
// Popup mode:
&mode=popup`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/oauth/token" desc="Exchange auth code for tokens">
            <Code block>{`Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&client_id=<site_id>
&client_secret=<api_secret>
&redirect_uri=https://yourapp.com/callback
// PKCE:
&code_verifier=<verifier>

// Response
{
  "access_token": "...",
  "id_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/oauth/userinfo" desc="Get user claims using access token">
            <Code block>{`Authorization: Bearer <access_token>

// Response
{
  "sub": "uid_...",
  "email": "user@example.com",
  "email_verified": true,
  "name": "Alice Smith",
  "given_name": "Alice",
  "family_name": "Smith",
  "picture": "https://..."
}`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/oauth/token" desc="Refresh tokens (grant_type=refresh_token)">
            <Code block>{`grant_type=refresh_token
&refresh_token=<token>
&client_id=<site_id>
&client_secret=<api_secret>`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/oauth/revoke" desc="Revoke access or refresh token (RFC 7009)">
            <Code block>{`token=<token>`}</Code>
          </Endpoint>
        </Box>
      )}

      {/* ── SITE INTEGRATION ── */}
      {active === 'site' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Site integration</Typography>
          <P>Simpler alternative to full OIDC — use these endpoints if you just need to authenticate users without implementing the full OAuth code exchange.</P>

          <Endpoint method="POST" path="/api/service/login" desc="Get a login URL for your site">
            <Code block>{`Authorization: Bearer <api_key>   // or X-API-Key: <api_key>

{
  "redirect_url": "https://yourapp.com/callback",
  "state": "<random>",
  "mode": "popup"   // optional
}

// Response
{ "login_url": "/oauth/authorize?...", "site_id": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/service/verify" desc="Verify a user token and get profile">
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

          <Endpoint method="GET" path="/api/service/info" desc="Get your site's registration info">
            <Code block>Authorization: Bearer &lt;api_key&gt;</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/service/my" desc="List sites owned by the current user">
            <Code block>Authorization: Bearer &lt;user_access_token&gt;</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/service/delete" desc="Delete a site">
            <Code block>{`Authorization: Bearer <user_access_token>
{ "site_id": "site_..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/service/user-deleted" desc="Notify Neo ID that a user deleted their account on your site">
            <Code block>{`Authorization: Bearer <api_key>
{ "unified_id": "uid_..." }`}</Code>
          </Endpoint>
        </Box>
      )}

      {/* ── AUTH API ── */}
      {active === 'auth' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Auth API</Typography>
          <P>Direct authentication endpoints — used by the Neo ID login page itself.</P>

          <Endpoint method="POST" path="/api/auth/password/login" desc="Login with email + password">
            <Code block>{`{
  "email": "user@example.com",
  "password": "...",
  // Optional — pass site context to redirect after login:
  "site_id": "site_...",
  "redirect_url": "https://yourapp.com/callback",
  "site_state": "<state>"
}

// Success
{ "access_token": "...", "refresh_token": "..." }

// TOTP required
{ "totp_required": true, "email": "..." }

// Email MFA required
{ "mfa_required": true, "email": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/password/register" desc="Register with email + password">
            <Code block>{`{ "email": "user@example.com", "password": "...", "display_name": "Alice" }

// Response — verification email sent
{ "verification_sent": true }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/auth/login/:provider" desc="Start OAuth login — provider: google, github, yandex, vk">
            <Code block>{`// Optional site context:
?site_id=...&redirect_url=...&site_state=...`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/refresh" desc="Rotate tokens — rolling refresh">
            <Code block>{`{ "refresh_token": "..." }

// Response — new pair, expiry extended
{ "access_token": "...", "refresh_token": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/logout" desc="Invalidate current session">
            <Code block>Authorization: Bearer &lt;access_token&gt;</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/auth/verify-email" desc="Verify email via link (token in query param)" />

          <Endpoint method="POST" path="/api/auth/verify-email/code" desc="Verify email with 6-digit code">
            <Code block>{`{ "email": "user@example.com", "code": "123456" }

// Response — auto-login
{ "verified": true, "access_token": "...", "refresh_token": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/auth/verify-email/resend" desc="Resend verification email">
            <Code block>{`{ "email": "user@example.com" }`}</Code>
          </Endpoint>
        </Box>
      )}

      {/* ── USER API ── */}
      {active === 'user' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>User API</Typography>
          <P>All endpoints require <Code>Authorization: Bearer &lt;access_token&gt;</Code></P>

          <Endpoint method="GET" path="/api/user/profile" desc="Get current user profile" />

          <Endpoint method="PUT" path="/api/user/profile" desc="Update profile fields">
            <Code block>{`{ "display_name": "Alice", "first_name": "Alice", "last_name": "Smith", "bio": "...", "location": "..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/profile/complete" desc="Set display name + avatar after first login">
            <Code block>{`{ "display_name": "Alice", "avatar_url": "/avatars/..." }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/avatar" desc="Upload avatar (multipart) or set stock avatar (JSON)">
            <Code block>{`// Multipart: field "avatar", max 5 MB
// JSON: { "avatar_url": "/avatars/..." }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/user/providers" desc="List linked OAuth providers + whether password is set" />

          <Endpoint method="POST" path="/api/user/provider/unlink" desc="Unlink an OAuth provider">
            <Code block>{`{ "provider": "google" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/password/set" desc="Set or change password">
            <Code block>{`{ "password": "new_password", "current_password": "old_password" }`}</Code>
          </Endpoint>

          <Endpoint method="GET" path="/api/user/services" desc="List connected services and available services" />

          <Endpoint method="POST" path="/api/user/services/connect" desc="Connect a service">
            <Code block>{`{ "service": "neomovies" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/services/disconnect" desc="Disconnect a service">
            <Code block>{`{ "service": "neomovies" }`}</Code>
          </Endpoint>
        </Box>
      )}

      {/* ── MFA ── */}
      {active === 'mfa' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 3 }}>MFA / 2FA</Typography>

          <Section title="Email MFA">
            <P>A 6-digit code is sent to the user's email on every login when enabled.</P>
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
            <P>Standard TOTP (RFC 6238). Compatible with Google Authenticator, Authy, 1Password, etc.</P>
            <Endpoint method="POST" path="/api/user/mfa/totp/setup" desc="Generate TOTP secret + QR code">
              <Code block>{`// Response
{
  "secret": "BASE32SECRET",
  "qr_code": "data:image/png;base64,...",
  "otpauth": "otpauth://totp/Neo%20ID:user@example.com?secret=..."
}`}</Code>
            </Endpoint>
            <Endpoint method="POST" path="/api/user/mfa/totp/verify" desc="Confirm first code and activate TOTP">
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

      {/* ── SESSIONS ── */}
      {active === 'sessions' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Sessions</Typography>
          <P>Access tokens expire after 24 hours. Refresh tokens are rolling — each use issues a new pair and extends the expiry by the configured duration (1–9 months). Up to 10 concurrent sessions per user; oldest is evicted when the limit is reached.</P>

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
    "last_used_at": "2026-04-06T12:00:00Z",
    "expires_at": "2026-04-07T12:00:00Z",
    "refresh_expires_at": "2026-05-06T12:00:00Z",
    "refresh_duration_months": 1,
    "is_current": true
  }]
}`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/sessions/revoke" desc="Revoke a specific session by ID">
            <Code block>{`{ "id": "<session_id>" }`}</Code>
          </Endpoint>

          <Endpoint method="POST" path="/api/user/sessions/refresh-duration" desc="Set refresh token duration for all future sessions">
            <Code block>{`{ "months": 3 }  // 1, 3, 6, or 9`}</Code>
          </Endpoint>
        </Box>
      )}

      {/* ── WEBHOOKS ── */}
      {active === 'webhooks' && (
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px', mb: 1 }}>Webhooks</Typography>
          <P>Neo ID sends webhook events to your site's <Code>webhook_url</Code> when certain actions occur.</P>

          <Section title="user.disconnected">
            <P>Fired when a user disconnects your service from their Neo ID account.</P>
            <Code block>{`POST <your_webhook_url>

{
  "event": "user.disconnected",
  "unified_id": "uid_...",
  "email": "user@example.com",
  "service": "neomovies"
}`}</Code>
            <P>Your server should delete or deactivate the user's local account.</P>
          </Section>

          <Section title="Notifying Neo ID of account deletion">
            <P>When a user deletes their account on your site, notify Neo ID so it can remove the service from their connected list:</P>
            <Code block>{`POST /api/service/user-deleted
Authorization: Bearer <api_key>

{ "unified_id": "uid_..." }`}</Code>
          </Section>

          <Section title="Admin client management">
            <P>Manage OIDC clients programmatically (requires admin role):</P>
            <Endpoint method="POST"   path="/api/admin/clients"            desc="Create a new OIDC client" />
            <Endpoint method="GET"    path="/api/admin/clients"            desc="List all clients" />
            <Endpoint method="PATCH"  path="/api/admin/clients/:client_id" desc="Update a client" />
            <Endpoint method="DELETE" path="/api/admin/clients/:client_id" desc="Delete a client" />
          </Section>
        </Box>
      )}

    </Box>
  )
}

export default function DocsPage() {
  const navigate = useNavigate()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [active, setActive] = useState('overview')

  const navItems = [
    { label: '← Dashboard', onClick: () => navigate('/dashboard') },
    ...SECTIONS.map((s) => ({
      label: s.label,
      onClick: () => setActive(s.id),
      active: active === s.id,
    })),
  ]

  return (
    <AppLayout title="Neo ID" subtitle="Documentation" navItems={navItems} sidebarWidth={200} mobileTitle="Docs">
      {isMobile && (
        <Box sx={{ px: 2, pt: 1, pb: 0 }}>
          <Select size="small" value={active} onChange={(e) => setActive(e.target.value)}
            sx={{ fontSize: '0.8rem', height: 30, minWidth: 160 }}>
            {SECTIONS.map((s) => <MenuItem key={s.id} value={s.id}>{s.label}</MenuItem>)}
          </Select>
        </Box>
      )}
      <Box sx={{ p: { xs: 2, md: 5 }, maxWidth: 780, minWidth: 0 }}>
        <Content active={active} />
      </Box>
    </AppLayout>
  )
}
