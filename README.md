<p align="center">
  <img src=".github/icon.png" width="120" height="120" style="border-radius: 24px;" />
</p>

<h1 align="center">Neo ID</h1>

<p align="center">
  Modern unified authentication service with OAuth 2.0, OIDC, and SaaS integration
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#documentation">Documentation</a> •
  <a href="#development">Development</a> •
  <a href="#api">API</a>
</p>

---

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

### Backend
- **Go** - Fast, reliable, and efficient
- **Beego** - MVC web framework
- **MongoDB** - Flexible document database
- **JWT** - HS256 (access/refresh) + RS256 (OIDC id_token)

### Frontend
- **React 18** - Modern UI library
- **TypeScript** - Type safety
- **Vite** - Lightning-fast build tool
- **React Router** - Client-side routing

## Quick Start

### Prerequisites

- Go 1.21+
- Node.js 18+
- MongoDB
- pnpm (recommended) or npm

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-org/neo-id.git
cd neo-id
```

2. **Install dependencies**
```bash
make deps
```

3. **Configure environment**

Copy `.env.example` to `.env` and fill in the values:

```env
# Database
MONGODB_URI=mongodb+srv://...

# JWT Secrets
JWT_SECRET=your-secret-key-here
SESSION_SECRET=your-session-secret-here

# Server
BASE_URL=http://localhost:8080
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173

# OAuth Providers (optional)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...

# Email (Resend)
RESEND_API_KEY=...
RESEND_FROM=Neo ID <no-reply@yourdomain.com>

# Legal documents change notifications (optional, recommended)
# Bump LEGAL_DOCS_VERSION when Terms/Privacy text changes.
# On backend start, Neo ID sends notification email to active users (deduplicated per version + user).
LEGAL_DOCS_VERSION=2026-05-21
LEGAL_NOTIFY_BATCH_SIZE=200
LEGAL_NOTIFY_ACTIVE_WINDOW_DAYS=3650

# Image Uploads (ImageKit, optional)
IMAGEKIT_PRIVATE_KEY=...
```

4. **Start development servers**

Terminal 1 - Backend:
```bash
FRONTEND_DEV_URL=http://localhost:5173 go run .
```

Terminal 2 - Frontend:
```bash
cd web && pnpm dev
```

5. **Open your browser**

Navigate to `http://localhost:8080`

## Development

### Project Structure

```
neo-id/
├── controllers/        # Legacy controllers (to be refactored)
├── internal/          # Internal packages
│   ├── handlers/      # HTTP handlers
│   ├── middleware/    # HTTP middleware
│   ├── services/      # Business logic
│   └── utils/         # Utility functions
├── models/            # Database models
├── pkg/               # Public packages
│   ├── config/        # Configuration
│   └── logger/        # Logging
├── routers/           # Route definitions
├── tests/             # All tests
│   ├── unit/          # Unit tests
│   ├── integration/   # Integration tests
│   └── e2e/           # End-to-end tests
└── web/               # Frontend application
    ├── src/
    │   ├── api/       # API client
    │   ├── components/# UI components
    │   ├── hooks/     # Custom hooks
    │   ├── pages/     # Page components
    │   ├── types/     # TypeScript types
    │   └── utils/     # Utilities
    └── public/        # Static assets
```

### Available Commands

```bash
make help              # Show all available commands
make build             # Build frontend and backend
make dev               # Start development mode
make test              # Run all tests
make test-unit         # Run unit tests
make test-coverage     # Run tests with coverage
make lint              # Lint code
make fmt               # Format code
```

### Running Tests

```bash
# All tests
make test

# Unit tests only
make test-unit

# Integration tests
make test-integration

# With coverage
make test-coverage
```

## Build

### Development Build
```bash
make build
```

### Production Build
```bash
make vercel-build
```

### Run Production Build
```bash
make run
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

## Documentation

### API Documentation
- **[API.md](API.md)** - Complete API reference with examples
- **[INTEGRATION.md](INTEGRATION.md)** - Integration guide for your apps

### Frontend Documentation
- **[web/README.md](web/README.md)** - Frontend development guide

### Testing Documentation
- **[tests/README.md](tests/README.md)** - Testing guide and best practices

## API

### API Overview

| Group | Prefix | Description |
|-------|--------|-------------|
| Auth | `/api/auth/*` | Login, register, OAuth, MFA, token refresh |
| User | `/api/user/*` | Profile, providers, sessions, TOTP setup |
| Admin | `/api/admin/*` | Users, services, sites, OIDC clients |
| Site | `/api/site/*` | SaaS integration endpoints |
| Service | `/api/service/*` | Legacy internal service integration |
| OIDC | `/oauth/*`, `/.well-known/*` | Standard OIDC endpoints |
| A/B Testing | `/api/ab/*` | Experiment management |

### Quick Examples

#### Authentication
```bash
# Register
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123"}'

# Login
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"secure123"}'
```

#### User Profile
```bash
# Get profile
curl http://localhost:8080/api/user/profile \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

#### A/B Testing
```bash
# Create experiment (admin)
curl -X POST http://localhost:8080/api/ab/experiments \
  -H "Authorization: Bearer ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "button_color",
    "variants": [
      {"name": "control", "weight": 50},
      {"name": "blue", "weight": 50}
    ]
  }'

# Get variant for user
curl http://localhost:8080/api/ab/variant/button_color \
  -H "Authorization: Bearer USER_TOKEN"
```

For complete API documentation, see **[API.md](API.md)**

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style

- Follow Go best practices
- Use `gofmt` for formatting
- Write tests for new features
- Update documentation

## Troubleshooting

### Common Issues

**MongoDB connection fails**
- Check `MONGODB_URI` in `.env`
- Ensure MongoDB is running
- Verify network connectivity

**Frontend build errors**
- Clear node_modules: `rm -rf web/node_modules`
- Reinstall: `cd web && pnpm install`
- Clear Vite cache: `rm -rf web/.vite`

**Tests failing**
- Ensure MongoDB is running
- Check test database configuration
- Run `make test-unit` first to isolate issues

## License

[MIT](LICENSE)

---

<p align="center">Made with ❤️ by the Neo-Open-Source</p>
