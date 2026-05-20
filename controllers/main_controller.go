package controllers

import (
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"

	"github.com/beego/beego/v2/server/web"
)

type MainController struct {
	web.Controller
}

func serveStaticFile(c *web.Controller, candidates []string, contentType string) bool {
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			if contentType != "" {
				c.Ctx.ResponseWriter.Header().Set("Content-Type", contentType)
			}
			http.ServeFile(c.Ctx.ResponseWriter, c.Ctx.Request, p)
			return true
		}
	}
	return false
}

func proxyFrontendDev(c *web.Controller) bool {
	frontendURL := os.Getenv("FRONTEND_DEV_URL")
	if frontendURL == "" {
		return false
	}

	target, err := url.Parse(frontendURL)
	if err != nil {
		return false
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
	}
	proxy.ServeHTTP(c.Ctx.ResponseWriter, c.Ctx.Request)
	return true
}

// Get serves the main SPA index.html
func (c *MainController) Get() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	indexFile := "static/app/index.html"
	if _, err := os.Stat(indexFile); err != nil {
		// Try alternative path
		indexFile = "static/index.html"
		if _, err := os.Stat(indexFile); err != nil {
			respondError(&c.Controller, http.StatusNotFound, "not_found", "Frontend not built")
			return
		}
	}
	file, err := os.Open(indexFile)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to serve index")
		return
	}
	defer file.Close()
	c.Ctx.ResponseWriter.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.Copy(c.Ctx.ResponseWriter, file)
}

func (c *MainController) Scalar() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	if serveStaticFile(&c.Controller, []string{"static/app/scalar.html", "static/scalar.html"}, "text/html; charset=utf-8") {
		return
	}
	respondError(&c.Controller, http.StatusNotFound, "not_found", "Scalar docs not found")
}

func (c *MainController) OpenAPI() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	if serveStaticFile(&c.Controller, []string{"static/app/openapi.json", "static/openapi.json"}, "application/json; charset=utf-8") {
		return
	}
	respondError(&c.Controller, http.StatusNotFound, "not_found", "OpenAPI spec not found")
}

// Favicon serves the favicon.ico
func (c *MainController) Favicon() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	paths := []string{"static/app/favicon.ico", "static/favicon.ico"}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			c.Ctx.ResponseWriter.Header().Set("Content-Type", "image/x-icon")
			c.Ctx.ResponseWriter.Header().Set("Cache-Control", "public, max-age=86400")
			http.ServeFile(c.Ctx.ResponseWriter, c.Ctx.Request, p)
			return
		}
	}
	c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
}
