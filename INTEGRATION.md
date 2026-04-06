# Neo ID — Integration Guide

## Concept

Neo ID provides:
- Authentication (OAuth: Google, GitHub, Yandex, VK + email/password)
- Basic profile (name, avatar, email)
- Unique `unified_id` for linking data across services

All business logic and data live on your side.

## Register your service

1. Go to `https://id.example.com` → Dashboard → Services → New client
2. You'll receive `site_id`, `api_key`, `api_secret`
3. Set your `redirect_uri` (web URL or mobile deep link)

## Auth flows

### Simple flow (token-based)

Best for most apps. No OIDC required.

**Step 1 — get login URL**

```js
const res = await fetch('https://id.example.com/api/service/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key',
  },
  body: JSON.stringify({
    redirect_url: 'https://yourapp.com/auth/callback',
    state: crypto.randomUUID(),
    mode: 'popup', // or omit for redirect
  }),
})
const { login_url } = await res.json()
// redirect user or open popup to login_url
```

**Step 2 — consent page**

If the user is already signed in to Neo ID, they skip the login form and land on the consent page. They approve access and Neo ID redirects back with an access token.

**Step 3 — callback**

```
GET https://yourapp.com/auth/callback?token=<access_token>&state=<state>
```

**Step 4 — verify token on your server**

```js
const res = await fetch('https://id.example.com/api/service/verify', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-API-Key': 'your_api_key',
  },
  body: JSON.stringify({ token: req.query.token }),
})
const { valid, user } = await res.json()

if (valid) {
  // user.unified_id — use as primary key in your DB
  // user.email, user.display_name, user.avatar
}
```

---

### OIDC flow (standard OAuth 2.0)

Use this if you need standard OpenID Connect compatibility (e.g. existing OIDC libraries).

Discovery document: `GET https://id.example.com/.well-known/openid-configuration`

```
GET /oauth/authorize
  ?client_id=<site_id>
  &redirect_uri=https://yourapp.com/callback
  &response_type=code
  &scope=openid profile email
  &state=<random>
  &code_challenge=<S256>        // PKCE recommended
  &code_challenge_method=S256
  &mode=popup                   // optional
```

Exchange code for tokens:

```
POST /oauth/token
Content-Type: application/x-www-form-urlencoded

grant_type=authorization_code
&code=<auth_code>
&client_id=<site_id>
&client_secret=<api_secret>
&redirect_uri=https://yourapp.com/callback
&code_verifier=<verifier>       // PKCE
```

Response:

```json
{
  "access_token": "...",
  "id_token": "...",
  "refresh_token": "...",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

Get user info:

```
GET /oauth/userinfo
Authorization: Bearer <access_token>
```

---

### Popup flow

For SPAs that want a popup window instead of a full redirect.

```js
// 1. Get login URL with mode=popup
const { login_url } = await fetch('/api/service/login', {
  method: 'POST',
  headers: { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ redirect_url: `${origin}/auth/callback`, state, mode: 'popup' }),
}).then(r => r.json())

// 2. Open popup
const popup = window.open(login_url, 'neo_id', 'width=480,height=640')

// 3. Listen for postMessage
window.addEventListener('message', async (e) => {
  if (e.data?.type !== 'neo_id_auth') return
  const { access_token, refresh_token } = e.data
  // exchange access_token with your backend
})
```

Neo ID sends `postMessage` with:

```json
{
  "type": "neo_id_auth",
  "access_token": "...",
  "refresh_token": "...",
  "state": "..."
}
```

---

## Database schema

```sql
-- Users table (unified_id as primary key)
CREATE TABLE users (
  id          VARCHAR(255) PRIMARY KEY,  -- unified_id from Neo ID
  email       VARCHAR(255) UNIQUE,
  name        VARCHAR(255),
  avatar_url  TEXT,
  created_at  TIMESTAMP DEFAULT NOW(),
  last_login  TIMESTAMP
);
```

---

## Node.js example (simple flow)

```js
const express = require('express')
const axios   = require('axios')
const app     = express()

const NEO_ID  = 'https://id.example.com'
const API_KEY = process.env.NEO_ID_API_KEY

// Redirect to Neo ID login
app.get('/login', async (req, res) => {
  const state = crypto.randomUUID()
  req.session.state = state

  const { data } = await axios.post(`${NEO_ID}/api/service/login`, {
    redirect_url: `${process.env.BASE_URL}/auth/callback`,
    state,
  }, { headers: { 'X-API-Key': API_KEY } })

  res.redirect(data.login_url)
})

// Handle callback
app.get('/auth/callback', async (req, res) => {
  const { token, state } = req.query

  if (state !== req.session.state) return res.redirect('/login?error=invalid_state')

  const { data } = await axios.post(`${NEO_ID}/api/service/verify`,
    { token },
    { headers: { 'X-API-Key': API_KEY } }
  )

  if (!data.valid) return res.redirect('/login?error=invalid_token')

  // Upsert user
  await db.query(`
    INSERT INTO users (id, email, name, avatar_url, last_login)
    VALUES ($1, $2, $3, $4, NOW())
    ON CONFLICT (id) DO UPDATE
      SET email = $2, name = $3, avatar_url = $4, last_login = NOW()
  `, [data.user.unified_id, data.user.email, data.user.display_name, data.user.avatar])

  req.session.userId = data.user.unified_id
  res.redirect('/dashboard')
})

function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect('/login')
  next()
}

app.get('/dashboard', requireAuth, (req, res) => {
  res.render('dashboard', { userId: req.session.userId })
})
```

---

## Go example (simple flow)

```go
neoID := "https://id.example.com"
apiKey := os.Getenv("NEO_ID_API_KEY")

// Get login URL
body, _ := json.Marshal(map[string]string{
    "redirect_url": "https://yourapp.com/auth/callback",
    "state":        state,
})
req, _ := http.NewRequest("POST", neoID+"/api/service/login", bytes.NewReader(body))
req.Header.Set("X-API-Key", apiKey)
req.Header.Set("Content-Type", "application/json")
resp, _ := http.DefaultClient.Do(req)

var result struct{ LoginURL string `json:"login_url"` }
json.NewDecoder(resp.Body).Decode(&result)
http.Redirect(w, r, result.LoginURL, http.StatusFound)

// Verify token
body, _ = json.Marshal(map[string]string{"token": token})
req, _ = http.NewRequest("POST", neoID+"/api/service/verify", bytes.NewReader(body))
req.Header.Set("X-API-Key", apiKey)
req.Header.Set("Content-Type", "application/json")
resp, _ = http.DefaultClient.Do(req)

var verify struct {
    Valid bool `json:"valid"`
    User  struct {
        UnifiedID   string `json:"unified_id"`
        Email       string `json:"email"`
        DisplayName string `json:"display_name"`
        Avatar      string `json:"avatar"`
    } `json:"user"`
}
json.NewDecoder(resp.Body).Decode(&verify)
```

---

## Webhooks

Neo ID calls your `webhook_url` when a user disconnects your service:

```json
POST <your_webhook_url>

{
  "event":      "user.disconnected",
  "unified_id": "uid_...",
  "email":      "user@example.com",
  "service":    "yourservice"
}
```

When a user deletes their account on your side, notify Neo ID:

```
POST /api/service/user-deleted
X-API-Key: your_api_key

{ "unified_id": "uid_..." }
```

---

## Security checklist

- Always validate the `state` parameter to prevent CSRF
- Keep `api_key` and `api_secret` server-side only — never expose in frontend code
- Use HTTPS in production
- Verify tokens on every request, not just at login
- Use PKCE when implementing the OIDC flow from a public client
