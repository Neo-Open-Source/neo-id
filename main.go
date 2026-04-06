package main

import (
	"fmt"
	"log"
	"os"
	"time"

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

	// Initialize RSA KeyManager for RS256 JWT signing
	km, err := controllers.NewKeyManager()
	if err != nil {
		log.Fatal("Failed to initialize KeyManager:", err)
	}
	controllers.GlobalKeyManager = km

	// Initialize database connection
	if err := models.InitDatabase(); err != nil {
		log.Fatal("Failed to initialize database:", err)
	}

	// Cleanup expired sessions every 24 hours
	go func() {
		ticker := time.NewTicker(24 * time.Hour)
		defer ticker.Stop()
		for range ticker.C {
			sessionCRUD := models.NewSessionCRUD()
			if err := sessionCRUD.CleanupExpiredSessions(); err != nil {
				log.Printf("CleanupExpiredSessions error: %v", err)
			}
		}
	}()

	// Initialize routers
	routers.InitRoutes()

	// Serve static files from Vercel build output
	if _, err := os.Stat("static"); err == nil {
		web.SetStaticPath("/assets", "static/app/assets")
		// Avatars: try dist first (Vite build), then static/avatars (local dev)
		if _, err2 := os.Stat("static/app/avatars"); err2 == nil {
			web.SetStaticPath("/avatars", "static/app/avatars")
		} else {
			web.SetStaticPath("/avatars", "static/avatars")
		}
	}

	port := web.AppConfig.DefaultInt("httpport", 8080)
	fmt.Printf("Unified ID Service starting on port %d\n", port)

	web.Run(fmt.Sprintf(":%v", port))
}
