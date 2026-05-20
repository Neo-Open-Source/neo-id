package middleware

import (
	"strings"

	"github.com/beego/beego/v2/server/web/context"
)

func RequireAuth() func(*context.Context) {
	return func(ctx *context.Context) {
		authHeader := ctx.Input.Header("Authorization")
		if authHeader == "" {
			ctx.Output.SetStatus(401)
			ctx.Output.JSON(map[string]string{"error": "Unauthorized"}, false, false)
			return
		}
		
		parts := strings.Split(authHeader, " ")
		if len(parts) != 2 || parts[0] != "Bearer" {
			ctx.Output.SetStatus(401)
			ctx.Output.JSON(map[string]string{"error": "Invalid authorization header"}, false, false)
			return
		}
	}
}

func RequireAPIKey() func(*context.Context) {
	return func(ctx *context.Context) {
		apiKey := ctx.Input.Header("X-API-Key")
		if apiKey == "" {
			ctx.Output.SetStatus(401)
			ctx.Output.JSON(map[string]string{"error": "API key required"}, false, false)
			return
		}
	}
}
