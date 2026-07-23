<p align="center">
  <img src=".github/icon.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Neo ID</h1>

<p align="center">
  Auth/OIDC provider — TypeScript monorepo. Email, OAuth (Google/GitHub), Passkeys, MFA (TOTP/email), sessions with refresh rotation, developer portal, and admin panel
</p>

<p align="center">
  <a href="https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FNeo-Open-Source%2Fneo-id&project-name=neo-id">
    <img src="https://vercel.com/button" alt="Deploy with Vercel" />
  </a>
  <a href="https://app.netlify.com/start/deploy?repository=https://github.com/Neo-Open-Source/neo-id">
    <img src="https://www.netlify.com/img/deploy/button.svg" alt="Deploy to Netlify" />
  </a>
</p>

## Features

- Email/password authentication with bcrypt hashing
- OAuth login (Google, GitHub)
- Passkey/WebAuthn (register + authenticate)
- Multi-factor authentication (TOTP, email codes)
- Password reset via email
- Session management with refresh token rotation
- Developer portal for OAuth service registration
- Admin panel for user/service management, audit logs
- Anonymous support tickets with auto-responses
- i18n (English, Ukrainian, Russian, Romanian)
- Device Code flow (RFC 8628) for TV/IoT
- GeoIP-based session tracking

## Stack

| Package | Technology |
|---------|-----------|
| `@neo-id/shared` | Zod schemas, TypeScript types, constants |
| `@neo-id/db` | Prisma 7 + PostgreSQL |
| `@neo-id/auth-core` | JWT (RS256), bcrypt, OAuth2, WebAuthn, TOTP |
| `@neo-id/api` | Hono HTTP server (serverless) |
| `@neo-id/web` | Next.js 16 (SSR, App Router) |
| `@neo-id/sdk` | JS/TS client SDK + React hooks |

## Environment

Copy `.env.example` and fill in the values:

```env
# Database (PostgreSQL via Prisma)
DATABASE_URL=postgresql://user:password@localhost:5432/neo-id

# JWT (RS256)
JWT_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
JWT_PUBLIC_KEY=-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----
JWT_ISSUER=https://id.neome.uk

# WebAuthn
RP_ID=id.neome.uk
ORIGIN=https://id.neome.uk

# OAuth
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email (Resend)
RESEND_API_KEY=re_...
EMAIL_FROM="Neo ID <no-reply@neome.uk>"

# URLs
WEB_URL=https://id.neome.uk
NEXT_PUBLIC_API_URL=https://id.neome.uk

# Security (Cloudflare Turnstile)
TURNSTILE_SECRET_KEY=...
TURNSTILE_SITE_KEY=...
```

## Development

```bash
pnpm install
cp .env.example .env
# Edit .env with your PostgreSQL URL and keys

# Generate JWT keys
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

# Push schema to database
pnpm --filter @neo-id/db exec prisma db push

# Generate Prisma client
pnpm db:generate

# Start dev
pnpm dev
```

## Deployment

### Vercel (Recommended)

Everything runs on Vercel on one subdomain (e.g., `id.neome.uk`):
- Frontend: Next.js app
- API: Serverless function at `/api`

1. Push to GitHub
2. Import on Vercel
3. Set environment variables in Vercel dashboard
4. Deploy

### Netlify

1. Push to GitHub
2. Connect repository on Netlify
3. Set environment variables
4. Deploy

## API Overview

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/auth/register` | Register with email/password |
| POST | `/api/v1/auth/login` | Login with email/password |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| POST | `/api/v1/auth/logout` | Logout (revoke session) |
| POST | `/api/v1/auth/forgot-password` | Request password reset |
| POST | `/api/v1/auth/reset-password` | Reset password with code |
| POST | `/api/v1/auth/oauth/:provider` | Start OAuth flow |
| GET | `/api/v1/auth/oauth/:provider/callback` | OAuth callback |

### User

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/user/profile` | Get profile |
| PUT | `/api/v1/user/profile` | Update profile |
| PUT | `/api/v1/user/password` | Change password |
| POST | `/api/v1/user/avatar` | Upload avatar |
| DELETE | `/api/v1/user` | Delete account |

### MFA

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/mfa/totp/setup` | Setup TOTP |
| POST | `/api/v1/mfa/totp/enable` | Enable TOTP |
| POST | `/api/v1/mfa/totp/disable` | Disable TOTP |
| POST | `/api/v1/mfa/email/setup` | Setup email MFA |
| POST | `/api/v1/mfa/email/enable` | Enable email MFA |
| POST | `/api/v1/mfa/email/disable` | Disable email MFA |
| POST | `/api/v1/mfa/verify` | Verify MFA during login |

### Passkeys

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/passkeys` | List passkeys |
| POST | `/api/v1/passkeys/register/start` | Start WebAuthn registration |
| POST | `/api/v1/passkeys/register/finish` | Finish WebAuthn registration |
| DELETE | `/api/v1/passkeys/:id` | Remove passkey |
| POST | `/api/v1/passkeys/authenticate/start` | Start WebAuthn auth |
| POST | `/api/v1/passkeys/authenticate/finish` | Finish WebAuthn auth |

### Developer Services

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/services` | List services |
| POST | `/api/v1/services` | Create service |
| GET | `/api/v1/services/:id` | Get service |
| PUT | `/api/v1/services/:id` | Update service |
| DELETE | `/api/v1/services/:id` | Delete service |
| POST | `/api/v1/services/:id/rotate-secret` | Rotate client secret |
| POST | `/api/v1/services/:id/logo` | Upload service logo |

### OIDC

| Method | Path | Description |
|--------|------|-------------|
| GET | `/.well-known/openid-configuration` | OIDC discovery |
| GET | `/.well-known/jwks.json` | JWKS public keys |

### Support

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/v1/support/tickets` | Create ticket |
| GET | `/api/v1/support/tickets` | List tickets |
| GET | `/api/v1/support/tickets/:id` | Get ticket detail |
| POST | `/api/v1/support/tickets/:id/messages` | Reply to ticket |

### Admin

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/users` | List users |
| GET | `/api/v1/admin/users/:id` | Get user |
| POST | `/api/v1/admin/users/:id/ban` | Ban/unban user |
| POST | `/api/v1/admin/users/:id/role` | Change user role |
| POST | `/api/v1/admin/users/:id/reset-password` | Reset user password |
| DELETE | `/api/v1/admin/users/:id` | Delete user |
| GET | `/api/v1/admin/stats` | Dashboard stats |
| GET | `/api/v1/admin/services` | List all services |

## Project Structure

```
packages/
├── shared/        # Types, constants, Zod schemas
├── db/            # Prisma schema, client, seed
├── auth-core/     # JWT, bcrypt, OAuth2, TOTP, WebAuthn
├── api/           # Hono HTTP server
├── sdk/           # JS/TS client SDK + React hooks
└── web/           # Next.js frontend (SSR)
```
