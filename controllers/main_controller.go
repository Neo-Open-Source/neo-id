package controllers

import (
	"io"
	"net/http"
	"os"

	"github.com/beego/beego/v2/server/web"
)

type MainController struct {
	web.Controller
}

// Get serves the main SPA index.html
func (c *MainController) Get() {
	indexFile := "static/app/index.html"
	if _, err := os.Stat(indexFile); err != nil {
		// Try alternative path
		indexFile = "static/index.html"
		if _, err := os.Stat(indexFile); err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
			c.Data["json"] = map[string]interface{}{"error": "Frontend not built"}
			c.ServeJSON()
			return
		}
	}
	file, err := os.Open(indexFile)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to serve index"}
		c.ServeJSON()
		return
	}
	defer file.Close()
	c.Ctx.ResponseWriter.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.Copy(c.Ctx.ResponseWriter, file)
}

// Favicon serves the favicon.ico
func (c *MainController) Favicon() {
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
