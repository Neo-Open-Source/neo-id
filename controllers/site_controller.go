package controllers

import "github.com/beego/beego/v2/server/web"

// SiteController handles site management and SaaS functionality.
// Methods are split across:
//   - site_management.go — CRUD (RegisterSite, GetMySites, DeleteSite, GetSiteInfo)
//   - site_oauth.go      — OAuth flow (SiteLogin, SiteCallback, VerifySiteToken, UserDeleted)
//   - site_helpers.go    — helpers (authenticateSite, buildAllowedOrigins, getAuthenticatedUser, etc.)
type SiteController struct {
	web.Controller
}
