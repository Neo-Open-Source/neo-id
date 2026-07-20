# AGENTS.md — neo-id-ts

## Project

Auth/OIDC provider — TypeScript monorepo rewrite. Replaces neo-id-rs (Rust).
Production domain: `https://id.neome.uk`. MongoDB database.

## Stack

| Layer | Choice |
|-------|--------|
| Language | TypeScript |
| API Framework | Hono |
| Database | MongoDB via Prisma |
| Auth | JWT RS256 (access/refresh/ID tokens), OAuth2 (Google/GitHub), WebAuthn, TOTP |
| Frontend | Next.js 15 (App Router, SSR) |
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
GET    /api/v1/user/profile
PUT    /api/v1/user/profile
PUT    /api/v1/user/password
GET    /.well-known/openid-configuration
GET    /.well-known/jwks.json
```

## Dev

```sh
pnpm install
cp .env.example .env
# Edit .env with MongoDB URI and JWT keys
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```
