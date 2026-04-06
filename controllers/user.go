package controllers

import "github.com/beego/beego/v2/server/web"

// UserController handles user profile and account management endpoints.
// Methods are split across:
//   - user_profile.go  — profile, avatar, password, providers
//   - user_apps.go     — service apps (create, list, revoke, delete)
//   - user_services.go — connected services (connect, disconnect)
//   - user_sessions.go — sessions and MFA (get, revoke, refresh duration, email MFA)
//   - user_helpers.go  — shared helpers (authenticateUser, isDeveloper, uploadToImageKit)
type UserController struct {
	web.Controller
}
