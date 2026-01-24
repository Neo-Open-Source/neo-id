package handler

import (
	"net/http"
	"os"

	"unified-id/controllers"
	"unified-id/models"
	"unified-id/routers"

	"github.com/beego/beego/v2/server/web"
	"github.com/joho/godotenv"
)

var app *web.HttpServer

func init() {
	_ = godotenv.Load()

	// Configure Beego for serverless
	web.BConfig.WebConfig.Session.SessionOn = true
	web.BConfig.WebConfig.Session.SessionProvider = "memory"
	web.BConfig.WebConfig.Session.SessionName = "unified_id_session"
	web.BConfig.WebConfig.Session.SessionCookieLifeTime = 3600 * 24 * 30 // 30 days

	controllers.InitOAuthProviders()

	// Initialize database connection
	if err := models.InitDatabase(); err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	// Initialize routers
	routers.InitRoutes()

	// Store the app instance
	app = web.BeeApp

	// Serve static files from Vercel build output
	if _, err := os.Stat("static"); err == nil {
		web.SetStaticPath("/assets", "static/app/assets")
	}
}

// Handler is the main serverless entry point
func Handler(w http.ResponseWriter, r *http.Request) {
	// Ensure static files are available
	if _, err := os.Stat("static"); err == nil {
		web.SetStaticPath("/assets", "static/app/assets")
	}

	// Use the app's Handlers which implements http.Handler
	app.Handlers.ServeHTTP(w, r)
}
