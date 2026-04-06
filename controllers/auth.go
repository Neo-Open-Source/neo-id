package controllers

import "github.com/beego/beego/v2/server/web"

// AuthController handles authentication endpoints.
// Methods are split across:
//   - auth_email.go      — email registration, login, verification, MFA
//   - auth_oauth.go      — OAuth providers (Google, GitHub)
//   - auth_tokens.go     — token generation, refresh, logout, health
//   - auth_email_helpers.go — email sending helpers
//   - auth_oauth_helpers.go — OAuth session helpers
type AuthController struct {
	web.Controller
}
