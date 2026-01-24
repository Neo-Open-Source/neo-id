package main

import (
	"fmt"
	"log"
	"os"

	"unified-id/controllers"
	"unified-id/models"
	"unified-id/routers"

	"github.com/joho/godotenv"

	"github.com/beego/beego/v2/server/web"
)

func main() {
	_ = godotenv.Load()

	web.BConfig.WebConfig.Session.SessionOn = true
	web.BConfig.WebConfig.Session.SessionProvider = "memory"
	web.BConfig.WebConfig.Session.SessionName = "unified_id_session"
	web.BConfig.WebConfig.Session.SessionCookieLifeTime = 3600 * 24 * 30 // 30 days

	controllers.InitOAuthProviders()

	// Initialize database connection
	if err := models.InitDatabase(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Initialize routers
	routers.InitRoutes()

	// Serve static files from Vercel build output
	if _, err := os.Stat("static"); err == nil {
		web.SetStaticPath("/assets", "static/app/assets")
		// Serve index.html for all non-API routes (already handled by routers.InitRoutes SPA fallback)
	}

	port := web.AppConfig.DefaultInt("httpport", 8080)
	fmt.Printf("Unified ID Service starting on port %d\n", port)

	web.Run(fmt.Sprintf(":%v", port))
}
