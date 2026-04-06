package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"unified-id/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// GetSessions returns all active sessions for the current user.
func (c *UserController) GetSessions() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	sessions, err := sessionCRUD.GetUserSessions(user.UnifiedID)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to get sessions")
		return
	}

	currentToken := strings.TrimPrefix(c.Ctx.Request.Header.Get("Authorization"), "Bearer ")

	var result []map[string]interface{}
	for _, s := range sessions {
		location := s.Country
		if s.City != "" && s.Country != "" {
			location = s.City + ", " + s.Country
		} else if s.City != "" {
			location = s.City
		}

		result = append(result, map[string]interface{}{
			"id":                      s.ID.Hex(),
			"ip_address":              s.IPAddress,
			"user_agent":              s.UserAgent,
			"country":                 s.Country,
			"city":                    s.City,
			"location":                location,
			"created_at":              s.CreatedAt,
			"last_used_at":            s.LastUsedAt,
			"expires_at":              s.ExpiresAt,
			"refresh_expires_at":      s.RefreshExpiresAt,
			"refresh_duration_months": s.RefreshDurationMonths,
			"is_current":              s.Token == currentToken,
		})
	}
	if result == nil {
		result = []map[string]interface{}{}
	}

	c.Data["json"] = map[string]interface{}{"sessions": result}
	c.ServeJSON()
}

// RevokeSession revokes a specific session by ID.
func (c *UserController) RevokeSession() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		ID string `json:"id"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if body.ID == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "id is required")
		return
	}

	oid, err := primitive.ObjectIDFromHex(body.ID)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid id")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	if err := sessionCRUD.RevokeSessionByID(oid, user.UnifiedID); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to revoke session")
		return
	}

	c.Data["json"] = map[string]interface{}{"revoked": true}
	c.ServeJSON()
}

// SetRefreshDuration sets the preferred refresh token duration for all new sessions.
func (c *UserController) SetRefreshDuration() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		Months int `json:"months"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if body.Months < 1 || body.Months > 9 {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "months must be between 1 and 9")
		return
	}

	user.RefreshDurationMonths = body.Months
	_ = models.NewUserCRUD().UpdateUser(user)
	_ = models.NewSessionCRUD().UpdateAllSessionsDuration(user.UnifiedID, body.Months)

	c.Data["json"] = map[string]interface{}{"refresh_duration_months": user.RefreshDurationMonths}
	c.ServeJSON()
}

// ToggleEmailMFA enables or disables email MFA for login.
func (c *UserController) ToggleEmailMFA() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		Enabled bool `json:"enabled"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	user.EmailMFAEnabled = body.Enabled
	_ = models.NewUserCRUD().UpdateUser(user)

	c.Data["json"] = map[string]interface{}{"email_mfa_enabled": user.EmailMFAEnabled}
	c.ServeJSON()
}

// verifyTOTPCode checks a TOTP code against a secret.
func verifyTOTPCode(code, secret string) bool {
	if secret == "" {
		return false
	}
	return totpValidate(code, secret)
}

// verifyEmailMFACode checks a pending email MFA code.
func verifyEmailMFACode(email, code string) bool {
	mfaCRUD := models.NewMFACodeCRUD()
	pending, err := mfaCRUD.GetByEmail(email)
	if err != nil || pending == nil {
		return false
	}
	if pending.Code != code {
		return false
	}
	_ = mfaCRUD.MarkUsed(pending.ID)
	return true
}

// verifyEmailMFACodeExpiry checks a pending email MFA code with expiry validation.
func verifyEmailMFACodeExpiry(email, code string) bool {
	mfaCRUD := models.NewMFACodeCRUD()
	pending, err := mfaCRUD.GetByEmail(email)
	if err != nil || pending == nil {
		return false
	}
	if pending.Code != code {
		return false
	}
	if time.Now().After(pending.ExpiresAt) {
		return false
	}
	_ = mfaCRUD.MarkUsed(pending.ID)
	return true
}
