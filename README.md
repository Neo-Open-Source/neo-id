<p align="center">
  <img src=".github/icon.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Neo ID</h1>

<p align="center">
  Auth/OIDC provider — TypeScript monorepo. Email, OAuth, Passkeys, MFA, sessions, developer portal, admin panel.
</p>

## Stack

| Package | Tech |
|---------|------|
| `@neo-id/shared` | Zod, TypeScript types, constants |
| `@neo-id/db` | Prisma 7 + PostgreSQL |
| `@neo-id/auth-core` | JWT (RS256), bcrypt, OAuth2, WebAuthn, TOTP |
| `@neo-id/api` | Hono HTTP server (Bun) |
| `@neo-id/web` | Next.js 16 (SSR, App Router) |
| `@neo-id/sdk` | JS/TS client SDK + React hooks |

## Quick Start

### Nix

Requires [Nix](https://nixos.org/download.html) with flakes.

```bash
git clone https://github.com/Neo-Open-Source/neo-id.git && cd neo-id
nix run    # PostgreSQL + API + Web
```

Development

```bash
nix develop              # dev shell (tools on PATH, manage servers yourself)
nix run .#reset          # wipe DB + node_modules, start fresh
```

### Just (no Nix)

Requires [just](https://just.systems), Node.js 24+, pnpm 9+, PostgreSQL 16+.

```bash
just setup
just dev
```

Run `just --list` for all commands.

### Manual

```bash
pnpm install
cp .env.example .env

openssl genrsa -out jwt-private.pem 2048
openssl rsa -in jwt-private.pem -pubout -out jwt-public.pem

pnpm db:generate
pnpm db:migrate
pnpm dev
```

## Environment

Required in `.env`:

```
DATABASE_URL          # PostgreSQL
JWT_PRIVATE_KEY       # RSA private key (PEM)
JWT_PUBLIC_KEY        # RSA public key (PEM)
```

Optional: `GOOGLE_CLIENT_ID`, `GITHUB_CLIENT_ID`, `RESEND_API_KEY`, `TURNSTILE_SECRET_KEY`.

## Deployment

**Vercel** — push to GitHub, import on Vercel, set env vars, deploy.

**Netlify** — push to GitHub, connect repo, set env vars, deploy.

## Contributing

[Rules](CONTRIBUTING.md)

## Diversity, Equity & Inclusion

[DEI](DEI.md)

## License

[MIT](LICENSE)
