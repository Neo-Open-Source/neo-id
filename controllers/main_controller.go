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
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		c.Data["json"] = map[string]interface{}{"error": "Frontend not built"}
		c.ServeJSON()
		return
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
