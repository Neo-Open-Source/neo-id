package middleware

import (
	"time"
	"unified-id/pkg/logger"

	"github.com/beego/beego/v2/server/web/context"
)

func RequestLogger() func(*context.Context) {
	return func(ctx *context.Context) {
		start := time.Now()
		
		method := ctx.Input.Method()
		path := ctx.Input.URI()
		
		ctx.Next()
		
		duration := time.Since(start)
		status := ctx.Output.Status
		
		logger.Infof("%s %s - %d - %v", method, path, status, duration)
	}
}
