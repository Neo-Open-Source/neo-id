package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"unified-id/models"
)

// SetAgeConsent stores one-time 16+ confirmation.
func (c *UserController) SetAgeConsent() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		Confirmed bool `json:"confirmed"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)
	if !body.Confirmed {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "16+ confirmation is required")
		return
	}

	now := time.Now()
	user.AgeConfirmed16Plus = true
	user.AgeConfirmedAt = &now
	if err := models.NewUserCRUD().UpdateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to save age confirmation")
		return
	}

	c.Data["json"] = map[string]interface{}{
		"age_confirmed_16_plus": true,
		"age_confirmed_at":      now,
	}
	c.ServeJSON()
}

// ReportTelemetry allows client-side error reports (auth optional).
func (c *UserController) ReportTelemetry() {
	var body struct {
		Message string `json:"message"`
		Details string `json:"details"`
		Route   string `json:"route"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	msg := strings.TrimSpace(body.Message)
	if msg == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "message is required")
		return
	}

	var userID, email string
	if user, _ := c.authenticateUser(); user != nil {
		userID = user.UnifiedID
		email = user.Email
	}

	event := &models.TelemetryEvent{
		UserID:    userID,
		Email:     email,
		Route:     strings.TrimSpace(body.Route),
		Message:   msg,
		Details:   strings.TrimSpace(body.Details),
		UserAgent: c.Ctx.Request.UserAgent(),
		IP:        getRealIP(c.Ctx.Request),
		Status:    "new",
	}
	if err := models.NewTelemetryCRUD().Create(event); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to store telemetry")
		return
	}
	c.Data["json"] = map[string]interface{}{"ok": true}
	c.ServeJSON()
}

// GetTelemetry returns latest telemetry events for admin/moderator.
func (c *AdminController) GetTelemetry() {
	actor, err := c.authenticateAdminOrModerator()
	if err != nil || actor == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized - admin/moderator access required")
		return
	}

	limit, _ := strconv.Atoi(c.GetString("limit", "100"))
	if limit < 1 {
		limit = 100
	}
	if limit > 500 {
		limit = 500
	}
	status := strings.TrimSpace(c.GetString("status"))
	rows, err := models.NewTelemetryCRUD().List(int64(limit), status)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to load telemetry")
		return
	}
	c.Data["json"] = map[string]interface{}{"events": rows}
	c.ServeJSON()
}
