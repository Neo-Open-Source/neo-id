package controllers

// CheckToken verifies an existing Neo ID access token and creates a consent session.
// Used by LoginPage when the user is already logged in — skips the login form.
//
// POST /api/auth/check-token
// Authorization: Bearer <access_token>
// Body: { client_id, redirect_uri, state, scope, mode }
// Response: { consent_url: "/consent?session=<key>" }

import (
	"encoding/json"
	"io"
	"net/http"
	"time"

	"unified-id/models"
)

func (c *AuthController) CheckToken() {
	// Authenticate via Bearer token
	user := c.tryGetExistingUserFromController()
	if user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Invalid or expired token")
		return
	}

	var body struct {
		ClientID    string `json:"client_id"`
		RedirectURI string `json:"redirect_uri"`
		State       string `json:"state"`
		Scope       string `json:"scope"`
		Mode        string `json:"mode"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if body.ClientID == "" || body.RedirectURI == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "client_id and redirect_uri are required")
		return
	}

	// Validate client
	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(body.ClientID)
	if err != nil || site == nil || !site.IsActive {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_client", "Unknown client_id")
		return
	}

	scope := body.Scope
	if scope == "" {
		scope = "openid profile email"
	}

	// Create consent session
	key := newConsentSession(&pendingConsent{
		ClientID:    body.ClientID,
		RedirectURI: body.RedirectURI,
		Scope:       scope,
		State:       body.State,
		Mode:        body.Mode,
		UserID:      user.UnifiedID,
		ExpiresAt:   time.Now().Add(10 * time.Minute),
	})

	c.Data["json"] = map[string]interface{}{
		"consent_url": "/consent?session=" + key,
	}
	c.ServeJSON()
}

// tryGetExistingUserFromController reads the Bearer token from Authorization header
// and returns the authenticated user (reuses logic from OIDCController).
func (c *AuthController) tryGetExistingUserFromController() *models.User {
	import_token := c.Ctx.Request.Header.Get("Authorization")
	if len(import_token) > 7 && import_token[:7] == "Bearer " {
		import_token = import_token[7:]
	}
	if import_token == "" {
		return nil
	}

	sessionCRUD := models.NewSessionCRUD()
	sess, err := sessionCRUD.GetSessionByToken(import_token)
	if err != nil || sess == nil {
		return nil
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(sess.UserID)
	if err != nil || user == nil || user.IsBanned {
		return nil
	}
	return user
}
