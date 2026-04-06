package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"unified-id/models"
)

// CreateServiceApp allows a developer to generate a service app token.
func (c *UserController) CreateServiceApp() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	if !c.isDeveloper(user) {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Developer role required")
		return
	}

	var requestData struct {
		Name string `json:"name"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if strings.TrimSpace(requestData.Name) == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}

	appCRUD := models.NewServiceAppCRUD()
	app, token, err := appCRUD.CreateServiceApp(strings.TrimSpace(requestData.Name), user.UnifiedID)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"service_app": app,
		"token":       token,
	}
	c.ServeJSON()
}

// ListServiceApps returns all service apps owned by the user.
func (c *UserController) ListServiceApps() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	if !c.isDeveloper(user) {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Developer role required")
		return
	}

	apps, err := models.NewServiceAppCRUD().ListByOwner(user.UnifiedID)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"service_apps": apps}
	c.ServeJSON()
}

// RevokeServiceApp revokes (disables) a service app token.
func (c *UserController) RevokeServiceApp() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	if !c.isDeveloper(user) {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Developer role required")
		return
	}

	var requestData struct {
		ID string `json:"id"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if strings.TrimSpace(requestData.ID) == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "id is required")
		return
	}

	if err := models.NewServiceAppCRUD().RevokeByID(user.UnifiedID, strings.TrimSpace(requestData.ID)); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"message": "revoked"}
	c.ServeJSON()
}

// DeleteServiceApp permanently deletes a service app.
func (c *UserController) DeleteServiceApp() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	if !c.isDeveloper(user) {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Developer role required")
		return
	}

	var requestData struct {
		ID string `json:"id"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if strings.TrimSpace(requestData.ID) == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "id is required")
		return
	}

	if err := models.NewServiceAppCRUD().DeleteByID(user.UnifiedID, strings.TrimSpace(requestData.ID)); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"message": "deleted"}
	c.ServeJSON()
}
