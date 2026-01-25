package routers

import (
	"unified-id/controllers"

	"github.com/beego/beego/v2/server/web"
)

func InitRoutes() {
	// API routes
	web.Router("/api/auth/login", &controllers.AuthController{}, "get:Login")
	web.Router("/api/auth/login/:provider", &controllers.AuthController{}, "get:Login")
	web.Router("/api/auth/callback", &controllers.AuthController{}, "get:Callback")
	web.Router("/api/auth/callback/:provider", &controllers.AuthController{}, "get:Callback")
	web.Router("/api/auth/password/login", &controllers.AuthController{}, "post:PasswordLogin")
	web.Router("/api/auth/password/register", &controllers.AuthController{}, "post:PasswordRegister")
	web.Router("/api/auth/verify-email", &controllers.AuthController{}, "get:VerifyEmail")
	web.Router("/api/auth/verify-email/resend", &controllers.AuthController{}, "post:ResendVerifyEmail")
	web.Router("/api/auth/logout", &controllers.AuthController{}, "post:Logout")
	web.Router("/api/auth/refresh", &controllers.AuthController{}, "post:RefreshToken")

	// User routes
	web.Router("/api/user/profile", &controllers.UserController{}, "get:GetProfile")
	web.Router("/api/user/profile", &controllers.UserController{}, "put:UpdateProfile")
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

	// Site management routes (new SaaS model)
	web.Router("/api/site/register", &controllers.SiteController{}, "post:RegisterSite")
	web.Router("/api/site/login", &controllers.SiteController{}, "post:SiteLogin")
	web.Router("/api/site/callback", &controllers.SiteController{}, "get:SiteCallback")
	web.Router("/api/site/verify", &controllers.SiteController{}, "post:VerifySiteToken")
	web.Router("/api/site/info", &controllers.SiteController{}, "get:GetSiteInfo")
	web.Router("/api/site/my", &controllers.SiteController{}, "get:GetMySites")

	// Dashboard routes (serve frontend)
	web.Router("/", &controllers.MainController{}, "get:Get")
	web.Router("/login", &controllers.MainController{}, "get:Get")
	web.Router("/dashboard", &controllers.MainController{}, "get:Get")
	web.Router("/register", &controllers.MainController{}, "get:Get")
	web.Router("/admin", &controllers.MainController{}, "get:Get")
	web.Router("/terms", &controllers.MainController{}, "get:Get")
	web.Router("/privacy", &controllers.MainController{}, "get:Get")
}
