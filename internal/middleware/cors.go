package middleware

import (
	"strings"

	"github.com/beego/beego/v2/server/web/context"
)

func CORS(allowedOrigins string) func(*context.Context) {
	origins := strings.Split(allowedOrigins, ",")
	
	return func(ctx *context.Context) {
		origin := ctx.Input.Header("Origin")
		
		allowed := false
		for _, o := range origins {
			if strings.TrimSpace(o) == origin || strings.TrimSpace(o) == "*" {
				allowed = true
				break
			}
		}
		
		if allowed {
			ctx.Output.Header("Access-Control-Allow-Origin", origin)
		}
		
		ctx.Output.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH")
		ctx.Output.Header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key, X-User-Token")
		ctx.Output.Header("Access-Control-Allow-Credentials", "true")
		ctx.Output.Header("Access-Control-Max-Age", "86400")
		
		if ctx.Input.Method() == "OPTIONS" {
			ctx.Output.SetStatus(204)
			return
		}
	}
}
