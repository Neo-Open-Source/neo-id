package controllers

import (
	"github.com/beego/beego/v2/server/web"
)

type DashboardController struct {
	web.Controller
}

// Index serves the main dashboard page
func (c *DashboardController) Index() {
	c.Data["title"] = "Unified ID Dashboard"
	c.TplName = "dashboard.html"
}

// Register serves the site registration page
func (c *DashboardController) Register() {
	c.Data["title"] = "Register Site - Unified ID"
	c.TplName = "register.html"
}
