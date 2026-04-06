<p align="center">
  <img src=".github/icon.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Neo ID</h1>

<p align="center">
  Go + Beego unified auth service with OAuth 2.0, OIDC, and SaaS site integration
</p>

## Features

- OAuth 2.0 / OpenID Connect (OIDC) provider
- Social login: Google, GitHub, Yandex, VK
- Email/password auth with email verification
- MFA: TOTP (authenticator app) + email codes
- SaaS site integration via API key
- Session management with geo-tracking
- Admin panel: users, services, sites
- React + MUI dashboard (served from `/`)

## Stack

- Backend: Go + Beego
- Database: MongoDB
- Frontend: React 18 + Vite + MUI (in `web/`)
- JWT: HS256 (access/refresh) + RS256 (OIDC id_token)

## Environment

Copy `.env` and fill in the values:

```env
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your-secret
SESSION_SECRET=your-session-secret
BASE_URL=http://localhost:8081
ALLOWED_ORIGINS=http://localhost:3000

# OAuth providers (optional, enable as needed)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email (Resend)
RESEND_API_KEY=...
RESEND_FROM=Neo ID <no-reply@yourdomain.com>

# Image uploads (ImageKit, optional)
IMAGEKIT_PRIVATE_KEY=...
```

Or configure via `conf/app.conf` — env vars take priority.

## Development

```bash
go mod tidy
go run .
```

```bash
cd web
npm install
npm run dev
```

## Build

```bash
make build   # builds frontend → static/, then Go binary
make run     # build + run
```

## Integrating your app

### 1. Register a site

Call the admin API or use the dashboard to create a site. You'll get:
- `site_id`
- `api_key`
- `api_secret`

### 2. SaaS flow (simple, token-based)

```js
// Step 1 — get login URL
const { login_url } = await fetch(`${NEO_ID_URL}/api/site/login`, {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ redirect_url: 'https://yourapp.com/callback', state: 'random' })
}).then(r => r.json());

window.location.href = login_url;

// Step 2 — verify token on callback
const { valid, user } = await fetch(`${NEO_ID_URL}/api/site/verify`, {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ token: urlParams.get('token') })
}).then(r => r.json());

// user.unified_id — use as primary key in your DB
// user.email, user.display_name, user.avatar
```

### 3. OIDC flow (standard OAuth 2.0)

Discovery document: `GET /.well-known/openid-configuration`

```
GET /oauth/authorize?client_id=<site_id>&redirect_uri=...&response_type=code&scope=openid+profile+email&state=...
POST /oauth/token        — exchange code for access_token, id_token, refresh_token
GET  /oauth/userinfo     — get user claims (Bearer access_token)
POST /oauth/revoke       — revoke token
GET  /.well-known/jwks.json — RSA public key for RS256 id_token verification
```

`client_secret` = your `api_secret`.

### 4. Legacy service integration

For internal services with a service app token:

```
POST /api/service/verify    — verify user JWT (requires service Bearer token + user token in body)
GET  /api/service/userinfo  — get user info (requires X-User-Token header)
```

## API overview

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/auth/*` | Login, register, OAuth, MFA, token refresh |
| User | `/api/user/*` | Profile, providers, sessions, TOTP setup |
| Admin | `/api/admin/*` | Users, services, sites, OIDC clients |
| Site | `/api/site/*` | SaaS integration endpoints |
| Service | `/api/service/*` | Legacy internal service integration |
| OIDC | `/oauth/*`, `/.well-known/*` | Standard OIDC endpoints |

Full route list: [`routers/routes.go`](routers/routes.go)  
Integration guide: [`INTEGRATION.md`](INTEGRATION.md)

## License

[MIT](LICENSE)
