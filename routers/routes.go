package routers

import (
	"unified-id/controllers"

	"github.com/beego/beego/v2/server/web"
)

func InitRoutes() {
	// Health check
	web.Router("/api/health", &controllers.AuthController{}, "get:Health")

	// API routes
	web.Router("/api/auth/login", &controllers.AuthController{}, "get:Login")
	web.Router("/api/auth/login/:provider", &controllers.AuthController{}, "get:Login")
	web.Router("/api/auth/callback", &controllers.AuthController{}, "get:Callback")
	web.Router("/api/auth/callback/:provider", &controllers.AuthController{}, "get:Callback")
	web.Router("/api/auth/password/login", &controllers.AuthController{}, "post:PasswordLogin")
	web.Router("/api/auth/password/register", &controllers.AuthController{}, "post:PasswordRegister")
	web.Router("/api/auth/mfa/verify", &controllers.AuthController{}, "post:MFAVerify")
	web.Router("/api/auth/totp/verify", &controllers.TOTPController{}, "post:LoginVerify")
	web.Router("/api/auth/verify-email", &controllers.AuthController{}, "get:VerifyEmail")
	web.Router("/api/auth/verify-email/code", &controllers.AuthController{}, "post:VerifyEmailCode")
	web.Router("/api/auth/verify-email/resend", &controllers.AuthController{}, "post:ResendVerifyEmail")
	web.Router("/api/auth/logout", &controllers.AuthController{}, "post:Logout")
	web.Router("/api/auth/refresh", &controllers.AuthController{}, "post:RefreshToken")

	// User routes
	web.Router("/api/user/profile", &controllers.UserController{}, "get:GetProfile")
	web.Router("/api/user/profile", &controllers.UserController{}, "put:UpdateProfile")
	web.Router("/api/user/profile/complete", &controllers.UserController{}, "post:CompleteProfile")
	web.Router("/api/user/avatar", &controllers.UserController{}, "post:SetAvatar")
	web.Router("/api/user/providers", &controllers.UserController{}, "get:GetProviders")
	web.Router("/api/user/provider/unlink", &controllers.UserController{}, "post:UnlinkProvider")
	web.Router("/api/user/password/set", &controllers.UserController{}, "post:SetPassword")
	web.Router("/api/user/services", &controllers.UserController{}, "get:GetConnectedServices")
	web.Router("/api/user/services/connect", &controllers.UserController{}, "post:ConnectService")
	web.Router("/api/user/services/disconnect", &controllers.UserController{}, "post:DisconnectService")
	web.Router("/api/user/service-apps", &controllers.UserController{}, "get:ListServiceApps")
	web.Router("/api/user/service-apps", &controllers.UserController{}, "post:CreateServiceApp")
	web.Router("/api/user/service-apps/revoke", &controllers.UserController{}, "post:RevokeServiceApp")
	web.Router("/api/user/service-apps/delete", &controllers.UserController{}, "post:DeleteServiceApp")

	// TOTP / MFA routes
	web.Router("/api/user/mfa/totp/setup", &controllers.TOTPController{}, "post:Setup")
	web.Router("/api/user/mfa/totp/verify", &controllers.TOTPController{}, "post:Verify")
	web.Router("/api/user/mfa/totp/disable", &controllers.TOTPController{}, "post:Disable")
	web.Router("/api/user/mfa/email/toggle", &controllers.UserController{}, "post:ToggleEmailMFA")
	web.Router("/api/user/mfa/email/send-code", &controllers.UserController{}, "post:SendMFACode")

	// Session management
	web.Router("/api/user/sessions", &controllers.UserController{}, "get:GetSessions")
	web.Router("/api/user/sessions/revoke", &controllers.UserController{}, "post:RevokeSession")
	web.Router("/api/user/sessions/refresh-duration", &controllers.UserController{}, "post:SetRefreshDuration")

	// Admin client (OIDC) management routes
	web.Router("/api/admin/clients", &controllers.AdminClientsController{}, "post:CreateClient")
	web.Router("/api/admin/clients", &controllers.AdminClientsController{}, "get:ListClients")
	web.Router("/api/admin/clients/:client_id", &controllers.AdminClientsController{}, "delete:DeleteClient")
	web.Router("/api/admin/clients/:client_id", &controllers.AdminClientsController{}, "patch:UpdateClient")

	// Admin routes
	web.Router("/api/admin/users", &controllers.AdminController{}, "get:GetUsers")
	web.Router("/api/admin/users/ban", &controllers.AdminController{}, "post:BanUser")
	web.Router("/api/admin/users/unban", &controllers.AdminController{}, "post:UnbanUser")
	web.Router("/api/admin/users/role", &controllers.AdminController{}, "post:SetUserRole")
	web.Router("/api/admin/services", &controllers.AdminController{}, "get:GetServices")
	web.Router("/api/admin/services", &controllers.AdminController{}, "post:CreateService")
	web.Router("/api/admin/sites", &controllers.AdminController{}, "get:GetSites")

	// Service integration routes (legacy)
	web.Router("/api/service/verify", &controllers.ServiceController{}, "post:VerifyToken")
	web.Router("/api/service/userinfo", &controllers.ServiceController{}, "get:GetUserInfo")

	// Service management routes
	web.Router("/api/service/register", &controllers.SiteController{}, "post:RegisterSite")
	web.Router("/api/service/login", &controllers.SiteController{}, "post:SiteLogin;options:SiteLogin")
	web.Router("/api/service/callback", &controllers.SiteController{}, "get:SiteCallback")
	web.Router("/api/service/verify", &controllers.SiteController{}, "post:VerifySiteToken")
	web.Router("/api/service/info", &controllers.SiteController{}, "get:GetSiteInfo")
	web.Router("/api/service/my", &controllers.SiteController{}, "get:GetMySites")
	web.Router("/api/service/delete", &controllers.SiteController{}, "post:DeleteSite")
	web.Router("/api/service/update", &controllers.SiteController{}, "post:UpdateService")
	web.Router("/api/service/user-deleted", &controllers.SiteController{}, "post:UserDeleted")

	// OpenID Connect endpoints
	web.Router("/.well-known/openid-configuration", &controllers.OIDCController{}, "get:Discovery")
	web.Router("/.well-known/jwks.json", &controllers.OIDCController{}, "get:JWKS")
	web.Router("/oauth/authorize", &controllers.OIDCController{}, "get:Authorize")
	web.Router("/oauth/token", &controllers.OIDCController{}, "post:Token;options:Token")
	web.Router("/oauth/userinfo", &controllers.OIDCController{}, "get:UserInfo;post:UserInfo")
	web.Router("/oauth/revoke", &controllers.OIDCController{}, "post:Revoke")
	web.Router("/oauth/callback", &controllers.OIDCController{}, "get:OIDCCallback")
	// Consent
	web.Router("/api/oauth/consent-info", &controllers.OIDCController{}, "get:ConsentInfo")
	web.Router("/api/oauth/consent", &controllers.OIDCController{}, "post:Consent")

	// Dashboard routes (serve frontend)
	web.Router("/", &controllers.MainController{}, "get:Get")
	web.Router("/login", &controllers.MainController{}, "get:Get")
	web.Router("/verify", &controllers.MainController{}, "get:Get")
	web.Router("/setup", &controllers.MainController{}, "get:Get")
	web.Router("/consent", &controllers.MainController{}, "get:Get")
	web.Router("/2fa", &controllers.MainController{}, "get:Get")
	web.Router("/dashboard", &controllers.MainController{}, "get:Get")
	web.Router("/admin", &controllers.MainController{}, "get:Get")
	web.Router("/services", &controllers.MainController{}, "get:Get")
	web.Router("/docs", &controllers.MainController{}, "get:Get")
	web.Router("/terms", &controllers.MainController{}, "get:Get")
	web.Router("/privacy", &controllers.MainController{}, "get:Get")
}
