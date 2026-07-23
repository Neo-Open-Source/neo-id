# AGENTS.md — neo-id-ts

## Project

Auth/OIDC provider — TypeScript monorepo.
Production domain: `https://id.neome.uk`.

## Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| API Framework | Hono (Bun) |
| Database | PostgreSQL via Prisma |
| Auth | JWT RS256 (access/refresh/ID tokens), OAuth2 (Google/GitHub), WebAuthn, TOTP |
| Frontend | Next.js 16 (App Router, SSR) |
| State Management | Zustand (client-side) |
| Validation | Zod |
| Build | tsup + Turborepo |
| Package Manager | pnpm workspaces |

## Monorepo Structure

```
packages/
├── shared/        # Types, constants, Zod schemas
├── db/            # Prisma schema, client, seed
├── auth-core/     # JWT, bcrypt, OAuth2, TOTP, WebAuthn
├── api/           # Hono HTTP server
├── sdk/           # JS/TS client SDK
└── web/           # Next.js frontend (SSR)
```

## Code Rules

### 1. NO HARDCODED VALUES
- All magic numbers, strings, limits → `packages/shared/src/constants.ts`
- All color/spacing values → CSS variables in `base.css` or Tailwind tokens
- Environment variables → `.env.example`, accessed via `process.env.*`

### 2. UI AND LOGIC SEPARATION
- Server Components: data fetching, DB queries, auth checks
- Client Components (`"use client"`): only UI interactivity
- No API calls in Client Components when Server Component can do it
- Zustand stores for cross-component client state only

### 3. NO DUPLICATE COMPONENTS
- One `Button` with `variant`/`size` props, not separate PrimaryButton/SecondaryButton
- One `Card`, one `Input`, one `Modal` — reuse with className and props
- Feature-specific components go in `components/features/<feature>/`

### 4. NO DUPLICATE LOGIC
- Extract repeated logic into custom hooks (`useUser`, `useAuth`)
- Shared utilities → `packages/shared/src/`
- Auth-core functions → `packages/auth-core/src/`
- API validation → `validate(schema, body)` from `packages/api/src/helpers/request.ts`
- Pagination → `parsePagination(query, defaultLimit)` from `packages/api/src/helpers/request.ts`

### 5. DICTIONARIES FOR UI STRINGS
- All user-facing text → i18n JSON files (`dictionaries/en.json`, etc.)
- Never hardcode: "Save changes", "Error", "Loading..."
- Use `t()` function or Server Component `getTranslations()`

### 6. CSS VARIABLES ONLY
- Use design tokens: `bg-surface`, `text-content`, `border-border`
- Never: `bg-[#0060DF]`, `bg-blue-600`, `text-gray-500`
- Never: inline `style={{ color: "..." }}` except dynamic values

### 7. COMPONENT FILE STRUCTURE
```
components/
├── ui/              # Reusable primitives (Button, Input, Card, Modal)
├── layout/          # Layout (Sidebar, Header, Footer)
├── features/        # Feature-specific
│   ├── auth/
│   ├── profile/
│   ├── services/
│   └── admin/
└── providers/       # Context providers
```

### 8. FILE NAMING
- Components: `PascalCase.tsx` (Button.tsx, ProfileCard.tsx)
- Hooks: `use*.ts` (useUser.ts, useAuth.ts)
- Utils: `camelCase.ts` (formatDate.ts)
- Constants: `constants.ts`
- Validation: `validation.ts`
- Types: `types.ts` or inline

### 9. RESPONSE FORMAT
```json
{
  "ok": true,
  "data": { ... },
  "meta": { "request_id": "uuid", "timestamp": "ISO8601" }
}
```

### 10. ERROR CODES
Use typed error codes from `@neo-id/shared`:
`INVALID_CREDENTIALS`, `MFA_REQUIRED`, `TOKEN_EXPIRED`, `USER_NOT_FOUND`, etc.

## API Routes

```
POST   /api/v1/auth/register
POST   /api/v1/auth/login
POST   /api/v1/auth/refresh
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/verify-email
GET    /api/v1/user/profile
PUT    /api/v1/user/profile
PUT    /api/v1/user/password
PUT    /api/v1/user/email
GET    /api/v1/sessions
DELETE /api/v1/sessions/:id
DELETE /api/v1/sessions
GET    /api/v1/passkeys
POST   /api/v1/passkeys/register/start
POST   /api/v1/passkeys/register/finish
DELETE /api/v1/passkeys/:id
POST   /api/v1/mfa/totp/setup
POST   /api/v1/mfa/totp/enable
POST   /api/v1/mfa/totp/disable
POST   /api/v1/mfa/email/setup
POST   /api/v1/mfa/email/enable
POST   /api/v1/mfa/email/disable
POST   /api/v1/mfa/verify
GET    /api/v1/services
POST   /api/v1/services
GET    /api/v1/services/:id
PUT    /api/v1/services/:id
DELETE /api/v1/services/:id
POST   /api/v1/services/:id/rotate-secret
POST   /api/v1/services/:id/logo
GET    /api/v1/support/tickets
POST   /api/v1/support/tickets
GET    /api/v1/support/tickets/:id
POST   /api/v1/support/tickets/:id/messages
POST   /api/v1/support/tickets/:id/close
POST   /api/v1/support/tickets/:id/reopen
GET    /api/v1/admin/users
GET    /api/v1/admin/users/:id
POST   /api/v1/admin/users/:id/ban
POST   /api/v1/admin/users/:id/role
POST   /api/v1/admin/users/:id/reset-password
DELETE /api/v1/admin/users/:id
GET    /api/v1/admin/stats
GET    /api/v1/admin/services
GET    /api/v1/admin/audit-logs
GET    /api/v1/admin/support/tickets
GET    /api/v1/admin/support/tickets/:id
POST   /api/v1/admin/support/tickets/:id/messages
POST   /api/v1/admin/support/tickets/:id/status
POST   /api/v1/oauth2/authorize
POST   /api/v1/oauth2/token
POST   /api/v1/oauth2/token/introspect
GET    /.well-known/openid-configuration
GET    /.well-known/jwks.json
POST   /api/v1/device/token
```

## Dev

```sh
pnpm install
cp .env.example .env
# Edit .env with DATABASE_URL (PostgreSQL)
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```
