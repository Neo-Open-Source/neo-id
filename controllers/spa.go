package controllers

import (
	"net/http"

	"github.com/beego/beego/v2/server/web"
)

type SpaController struct {
	web.Controller
}

func (c *SpaController) Index() {
	c.Ctx.Output.Header("Cache-Control", "no-store")
	c.Ctx.Output.Header("Pragma", "no-cache")
	c.Ctx.Output.Header("Expires", "0")
	http.ServeFile(c.Ctx.ResponseWriter, c.Ctx.Request, "static/app/index.html")
}
