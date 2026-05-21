# Neo ID API Documentation

## Table of Contents

1. [Authentication](#authentication)
2. [User Management](#user-management)
3. [OAuth & OIDC](#oauth--oidc)
4. [Site Integration](#site-integration)
5. [Admin](#admin)
6. [A/B Testing](#ab-testing)

---

## Authentication

### POST /api/auth/register
Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "message": "Verification email sent"
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request
- `409` - Email already exists

---

### POST /api/auth/login
Login with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "user": {
    "id": "user_id",
    "email": "user@example.com",
    "display_name": "John Doe"
  }
}
```

**Status Codes:**
- `200` - Success
- `401` - Invalid credentials
- `403` - Email not verified

---

### POST /api/auth/refresh
Refresh access token using refresh token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGc..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

---

### GET /api/auth/login/:provider
Initiate OAuth login with provider (google, github, yandex, vk).

**Query Parameters:**
- `site_id` (optional) - Site ID for integration
- `redirect_url` (optional) - Redirect URL after login

**Response:**
Redirects to OAuth provider

---

## User Management

### GET /api/user/profile
Get current user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "id": "user_id",
  "email": "user@example.com",
  "display_name": "John Doe",
  "avatar": "https://...",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### PUT /api/user/profile
Update user profile.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Request Body:**
```json
{
  "display_name": "Jane Doe",
  "avatar": "https://..."
}
```

**Response:**
```json
{
  "message": "Profile updated"
}
```

---

### GET /api/user/sessions
Get active sessions.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "sessions": [
    {
      "id": "session_id",
      "device": "Chrome on macOS",
      "ip": "192.168.1.1",
      "location": "San Francisco, US",
      "last_active": "2024-01-01T00:00:00Z"
    }
  ]
}
```

---

## OAuth & OIDC

### GET /.well-known/openid-configuration
Get OIDC discovery document.

**Response:**
```json
{
  "issuer": "https://neoid.dev",
  "authorization_endpoint": "https://neoid.dev/oauth/authorize",
  "token_endpoint": "https://neoid.dev/oauth/token",
  "userinfo_endpoint": "https://neoid.dev/oauth/userinfo",
  "jwks_uri": "https://neoid.dev/.well-known/jwks.json"
}
```

---

### GET /oauth/authorize
OIDC authorization endpoint.

**Query Parameters:**
- `client_id` (required) - Client ID
- `redirect_uri` (required) - Redirect URI
- `response_type` (required) - Response type (code)
- `scope` (required) - Scope (openid profile email)
- `state` (optional) - State parameter

---

### POST /oauth/token
Exchange authorization code for tokens.

**Request Body:**
```json
{
  "grant_type": "authorization_code",
  "code": "auth_code",
  "redirect_uri": "https://yourapp.com/callback",
  "client_id": "client_id",
  "client_secret": "client_secret"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGc...",
  "id_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## Site Integration

### POST /api/site/login
Get login URL for site integration.

**Headers:**
```
X-API-Key: <site_api_key>
```

**Request Body:**
```json
{
  "redirect_url": "https://yourapp.com/callback",
  "state": "random_state"
}
```

**Response:**
```json
{
  "login_url": "https://neoid.dev/login?site_id=..."
}
```

---

## Widget Auth

### GET /widget/auth
Device-login page for embedded widget flow (QR + text code).  
This page is intended to be loaded inside an iframe by the Neo ID widget SDK.

**Behavior:**
- Creates a device code via `POST /api/device/code`
- Polls `POST /api/device/poll` until confirmation
- Sends `postMessage` to parent window on success

**postMessage payload:**
```json
{
  "type": "neo_id_widget_auth",
  "status": "confirmed",
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc..."
}
```

---

### GET /widget/sdk.js
Browser SDK for mounting the embedded widget.

**Usage:**
```html
<script src="https://id.example.com/widget/sdk.js"></script>
<div id="neo-widget"></div>
<script>
  const widget = window.NeoIDWidget.mount('#neo-widget', {
    baseUrl: 'https://id.example.com',
    onSuccess(tokens) {
      console.log('Neo ID auth success', tokens)
    },
  })

  // later, if needed:
  // widget.destroy()
</script>
```

---

### POST /api/site/verify
Verify user token from callback.

**Headers:**
```
X-API-Key: <site_api_key>
```

**Request Body:**
```json
{
  "token": "user_token"
}
```

**Response:**
```json
{
  "valid": true,
  "user": {
    "unified_id": "user_id",
    "email": "user@example.com",
    "display_name": "John Doe",
    "avatar": "https://..."
  }
}
```

---

## Admin

### GET /api/admin/users
List all users (admin only).

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Query Parameters:**
- `page` (optional) - Page number (default: 1)
- `limit` (optional) - Items per page (default: 20)

**Response:**
```json
{
  "users": [...],
  "total": 100,
  "page": 1,
  "limit": 20
}
```

---

### POST /api/admin/sites
Create new site (admin only).

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "name": "My App",
  "domain": "myapp.com",
  "redirect_uris": ["https://myapp.com/callback"]
}
```

**Response:**
```json
{
  "site_id": "site_id",
  "api_key": "api_key",
  "api_secret": "api_secret"
}
```

---

## A/B Testing

### POST /api/ab/experiments
Create new A/B test experiment (admin only).

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Request Body:**
```json
{
  "name": "button_color_test",
  "variants": [
    {"name": "control", "weight": 50},
    {"name": "blue_button", "weight": 50}
  ]
}
```

**Response:**
```json
{
  "message": "Experiment created",
  "experiment": {
    "name": "button_color_test",
    "variants": [...],
    "active": true
  }
}
```

---

### GET /api/ab/variant/:experiment
Get variant for current user.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:**
```json
{
  "experiment": "button_color_test",
  "variant": "blue_button"
}
```

---

### GET /api/ab/experiments
List all experiments (admin only).

**Headers:**
```
Authorization: Bearer <admin_access_token>
```

**Response:**
```json
{
  "experiments": [
    {
      "name": "button_color_test",
      "variants": [...],
      "active": true
    }
  ]
}
```

---

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "error": "Error message"
}
```

Common status codes:
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
