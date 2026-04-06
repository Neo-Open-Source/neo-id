package controllers

import (
	"net/http"

	"github.com/beego/beego/v2/server/web"
)

// respondError writes a JSON error response with the given HTTP status code.
// The response body follows the OAuth 2.0 error format:
//
//	{"error": "<code>", "error_description": "<description>"}
//
// For HTTP 401 responses, it automatically adds the WWW-Authenticate header.
func respondError(c *web.Controller, status int, code, description string) {
	if status == http.StatusUnauthorized {
		c.Ctx.Output.Header("WWW-Authenticate", `Bearer realm="neo-id", error="invalid_token"`)
	}
	c.Ctx.Output.Status = status
	c.Data["json"] = map[string]interface{}{
		"error":             code,
		"error_description": description,
	}
	c.ServeJSON()
}
