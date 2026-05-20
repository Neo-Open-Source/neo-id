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
var initialized bool

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
	primaryDomain := strings.ToLower(strings.TrimSpace(os.Getenv("APP_PRIMARY_DOMAIN")))
	if primaryDomain != "" && (host == primaryDomain || strings.HasSuffix(host, "."+primaryDomain)) {
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

	allowedRaw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
	allowed := map[string]struct{}{}
	for _, v := range strings.Split(allowedRaw, ",") {
		vv := strings.TrimSpace(v)
		if vv != "" {
			allowed[vv] = struct{}{}
		}
	}
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

func initialize() {
	_ = godotenv.Load()

	web.BConfig.AppName = "neo-id"
	web.BConfig.RunMode = "prod"
	web.BConfig.WebConfig.Session.SessionOn = false

	controllers.InitOAuthProviders()

	if err := models.InitDatabase(); err != nil {
		panic("Failed to initialize database: " + err.Error())
	}

	routers.InitRoutes()

	web.InsertFilter("/api/*", web.BeforeRouter, corsFilter)
	web.InsertFilter("/api/*", web.BeforeRouter, func(ctx *webctx.Context) {
		if ctx.Input.Method() == http.MethodOptions {
			origin := ctx.Input.Header("Origin")
			if origin != "" {
				allowedRaw := strings.TrimSpace(os.Getenv("ALLOWED_ORIGINS"))
				allowed := map[string]struct{}{}
				for _, v := range strings.Split(allowedRaw, ",") {
					vv := strings.TrimSpace(v)
					if vv != "" {
						allowed[vv] = struct{}{}
					}
				}
				allowed["http://localhost:3000"] = struct{}{}
				allowed["http://localhost:5173"] = struct{}{}

				if !isAllowedOrigin(origin, allowed) {
					ctx.Output.SetStatus(http.StatusNoContent)
					_, _ = ctx.ResponseWriter.Write([]byte{})
					return
				}

				ctx.Output.Header("Access-Control-Allow-Origin", origin)
				ctx.Output.Header("Vary", "Origin")
				ctx.Output.Header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH")
				ctx.Output.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
				ctx.Output.Header("Access-Control-Max-Age", "86400")
			}
			ctx.Output.SetStatus(http.StatusNoContent)
			_, _ = ctx.ResponseWriter.Write([]byte{})
		}
	})

	app = web.BeeApp

	if _, err := os.Stat("static"); err == nil {
		web.SetStaticPath("/assets", "static/app/assets")
	}

	initialized = true
}

// Handler is the main serverless entry point
func Handler(w http.ResponseWriter, r *http.Request) {
	if !initialized {
		initialize()
	}

	if _, err := os.Stat("static"); err == nil {
		web.SetStaticPath("/assets", "static/app/assets")
	}

	app.Handlers.ServeHTTP(w, r)
}
