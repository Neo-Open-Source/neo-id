# Neo ID

Auth/OIDC provider — TypeScript monorepo rewrite.

## Stack

| Package | Technology |
|---------|-----------|
| `@neo-id/shared` | Zod schemas, TypeScript types, constants |
| `@neo-id/db` | Prisma + MongoDB |
| `@neo-id/auth-core` | JWT (RS256), bcrypt, OAuth2, WebAuthn, TOTP |
| `@neo-id/api` | Hono HTTP server |
| `@neo-id/web` | Next.js 16 (SSR, App Router) |
| `@neo-id/sdk` | JS/TS client SDK + React hooks |

## Getting Started

```bash
# Install dependencies
pnpm install

# Set up environment
cp .env.example .env
# Edit .env with your MongoDB URI and keys

# Generate JWT keys
openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem
# Add PEM contents to .env as JWT_PRIVATE_KEY and JWT_PUBLIC_KEY

# Run migrations
pnpm db:generate
pnpm db:migrate

# Seed database
pnpm db:seed

# Start dev
pnpm dev
```

## API Endpoints

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

## Development

```bash
pnpm dev          # Start all packages
pnpm build        # Build all packages
pnpm test         # Run tests
pnpm test:e2e     # Run E2E tests
```
