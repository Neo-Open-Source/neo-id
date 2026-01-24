package handler

import (
	"net/http"
	"net/url"
	"os"
	"strings"

	"unified-id/controllers"
	"unified-id/models"
	"unified-id/routers"

	"github.com/beego/beego/v2/server/web"
	webctx "github.com/beego/beego/v2/server/web/context"
	"github.com/joho/godotenv"
)

var app *web.HttpServer

func isAllowedOrigin(origin string, allowed map[string]struct{}) bool {
	if origin == "" {
		return false
	}
	if _, ok := allowed[origin]; ok {
		return true
	}
	u, err := url.Parse(origin)
	if err != nil {
		return false
	}
	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if host == "" {
		return false
	}
	if host == "neomovies.ru" || strings.HasSuffix(host, ".neomovies.ru") {
		return true
	}
	if strings.HasSuffix(host, ".vercel.app") {
		return true
	}
	return false
}

func corsFilter(ctx *webctx.Context) {
	origin := ctx.Input.Header("Origin")
	if origin == "" {
		return
	}

	allowedRaw := web.AppConfig.DefaultString("allowed_origins", "")
	allowed := map[string]struct{}{}
	for _, v := range strings.Split(allowedRaw, ",") {
		vv := strings.TrimSpace(v)
		if vv != "" {
			allowed[vv] = struct{}{}
		}
	}
	// local dev
	allowed["http://localhost:3000"] = struct{}{}
	allowed["http://localhost:5173"] = struct{}{}

	if isAllowedOrigin(origin, allowed) {
		ctx.Output.Header("Access-Control-Allow-Origin", origin)
		ctx.Output.Header("Vary", "Origin")
		ctx.Output.Header("Access-Control-Allow-Credentials", "true")
		ctx.Output.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS")
		ctx.Output.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
	}

	if ctx.Input.Method() == http.MethodOptions {
		ctx.Output.SetStatus(http.StatusNoContent)
		_, _ = ctx.ResponseWriter.Write([]byte{})
	}
}

func init() {
	_ = godotenv.Load()

	// Configure Beego for serverless - disable sessions for now
	web.BConfig.WebConfig.Session.SessionOn = false
	web.BConfig.RunMode = "prod"

	controllers.InitOAuthProviders()

	// Initialize database connection
	if err := models.InitDatabase(); err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	// Initialize routers
	routers.InitRoutes()

	// CORS for browser-based API calls (e.g. NeoMovies Web -> Neo ID)
	web.InsertFilter("/api/*", web.BeforeRouter, corsFilter)

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
