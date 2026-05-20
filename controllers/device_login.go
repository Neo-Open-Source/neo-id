package controllers

// DeviceController handles TV/device login flow.
//
// POST /api/device/code   — generate a new device code (TV calls this)
// POST /api/device/poll   — poll for confirmation (TV polls this)
// POST /api/device/confirm — confirm the code (phone calls this, requires auth)

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
)

type DeviceController struct {
	web.Controller
}

// GenerateCode creates a new device code pair and returns it.
// POST /api/device/code
func (c *DeviceController) GenerateCode() {
	crud := models.NewDeviceCodeCRUD()
	dc, err := crud.Create()
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate code")
		return
	}
	c.Data["json"] = map[string]interface{}{
		"device_code": dc.DeviceCode,
		"user_code":   dc.UserCode,
		"expires_in":  300, // seconds
	}
	c.ServeJSON()
}

// Poll checks the status of a device code.
// POST /api/device/poll
// Body: { "device_code": "..." }
// Response: { "status": "pending" | "confirmed" | "expired", "access_token": "...", "refresh_token": "..." }
func (c *DeviceController) Poll() {
	var body struct {
		DeviceCode string `json:"device_code"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	if err := json.Unmarshal(raw, &body); err != nil || body.DeviceCode == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "device_code is required")
		return
	}

	crud := models.NewDeviceCodeCRUD()
	dc, err := crud.GetByDeviceCode(body.DeviceCode)
	if err != nil || dc == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "Device code not found")
		return
	}

	if time.Now().After(dc.ExpiresAt) || dc.Status == "expired" {
		c.Data["json"] = map[string]interface{}{"status": "expired"}
		c.ServeJSON()
		return
	}

	if dc.Status != "confirmed" || dc.UserID == "" {
		c.Data["json"] = map[string]interface{}{"status": "pending"}
		c.ServeJSON()
		return
	}

	// Confirmed — generate tokens
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(dc.UserID)
	if err != nil || user == nil || user.IsBanned {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "User not found or banned")
		return
	}

	accessToken, refreshToken, refreshExp, err := generateTokensWithDuration(user.UnifiedID, user.Email, 1)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate tokens")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	if err := sessionCRUD.CreateSession(&models.Session{
		Token:                accessToken,
		RefreshToken:         refreshToken,
		UserID:               user.UnifiedID,
		ExpiresAt:            time.Now().Add(24 * time.Hour),
		RefreshExpiresAt:     refreshExp,
		RefreshDurationMonths: 1,
		IPAddress:            getRealIP(c.Ctx.Request),
		UserAgent:            c.Ctx.Request.UserAgent(),
	}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to create session")
		return
	}

	c.Data["json"] = map[string]interface{}{
		"status":        "confirmed",
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	c.ServeJSON()
}

// Confirm approves a device code from the phone (requires auth).
// POST /api/device/confirm
// Authorization: Bearer <access_token>
// Body: { "user_code": "ABC123" }
func (c *DeviceController) Confirm() {
	// Authenticate the phone user
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	sess, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || sess == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(sess.UserID)
	if err != nil || user == nil || user.IsBanned {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "User not found or banned")
		return
	}

	var body struct {
		UserCode string `json:"user_code"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	if err := json.Unmarshal(raw, &body); err != nil || body.UserCode == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "user_code is required")
		return
	}

	crud := models.NewDeviceCodeCRUD()
	dc, err := crud.GetByUserCode(strings.ToUpper(strings.TrimSpace(body.UserCode)))
	if err != nil || dc == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "Code not found or expired")
		return
	}

	if err := crud.Confirm(dc.DeviceCode, user.UnifiedID); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to confirm code")
		return
	}

	c.Data["json"] = map[string]interface{}{"status": "confirmed"}
	c.ServeJSON()
}
