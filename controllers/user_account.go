package controllers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"unified-id/models"

	"go.mongodb.org/mongo-driver/bson"
	"golang.org/x/crypto/bcrypt"
)

type accountActionRequest struct {
	MFACode          string `json:"mfa_code"`
	Password         string `json:"password"`
	PasskeyAssertion *struct {
		RawID    string `json:"rawId"`
		Response struct {
			ClientDataJSON string `json:"clientDataJSON"`
		} `json:"response"`
	} `json:"passkey_assertion,omitempty"`
}

func parseAccountActionRequest(c *UserController) accountActionRequest {
	var req accountActionRequest
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &req)
	return req
}

func verifySensitiveAction(c *UserController, user *models.User, action string, req accountActionRequest) bool {
	// If user has no MFA/passkeys, require password (when available).
	passkeys, _ := models.NewPasskeyCRUD().ListByUserID(user.UnifiedID)
	hasPasskeys := len(passkeys) > 0
	requiresCheck := user.TOTPEnabled || user.EmailMFAEnabled || hasPasskeys
	if !requiresCheck {
		if strings.TrimSpace(user.PasswordHash) != "" {
			if strings.TrimSpace(req.Password) == "" {
				respondError(&c.Controller, http.StatusBadRequest, "password_required", "Password is required")
				return false
			}
			if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
				respondError(&c.Controller, http.StatusBadRequest, "invalid_password", "Invalid password")
				return false
			}
		}
		return true
	}

	code := strings.TrimSpace(req.MFACode)
	if code != "" {
		// If both factors are enabled, accept either valid TOTP or valid email code.
		if user.TOTPEnabled && verifyTOTPCode(code, user.TOTPSecret) {
			return true
		}
		if user.EmailMFAEnabled && verifyEmailMFACodeExpiry(user.Email, code) {
			return true
		}
		if user.TOTPEnabled && user.EmailMFAEnabled {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_code", "Invalid authenticator or email verification code")
			return false
		}
		if user.TOTPEnabled {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_code", "Invalid authenticator code")
			return false
		}
		if user.EmailMFAEnabled {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_code", "Invalid verification code")
			return false
		}
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "MFA code is not required for this account")
		return false
	}

	// Passkey assertion fallback
	if req.PasskeyAssertion != nil {
		chal, err := models.NewPasskeyChallengeCRUD().GetByUserID(user.UnifiedID)
		if err != nil || chal == nil || time.Now().After(chal.ExpiresAt) || chal.Type != "account_action:"+action {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "passkey challenge expired")
			return false
		}

		if strings.TrimSpace(req.PasskeyAssertion.RawID) == "" || strings.TrimSpace(req.PasskeyAssertion.Response.ClientDataJSON) == "" {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid passkey assertion")
			return false
		}

		clientDataBytes, err := base64.RawURLEncoding.DecodeString(req.PasskeyAssertion.Response.ClientDataJSON)
		if err != nil {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid clientDataJSON")
			return false
		}
		var clientData struct {
			Type      string `json:"type"`
			Challenge string `json:"challenge"`
		}
		if err := json.Unmarshal(clientDataBytes, &clientData); err != nil {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid clientDataJSON format")
			return false
		}
		if clientData.Type != "webauthn.get" || clientData.Challenge != chal.Challenge {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "passkey challenge mismatch")
			return false
		}

		matched := false
		for _, p := range passkeys {
			if p.CredentialID == req.PasskeyAssertion.RawID {
				matched = true
				break
			}
		}
		if !matched {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "unknown passkey")
			return false
		}

		_ = models.NewPasskeyChallengeCRUD().DeleteByUserID(user.UnifiedID)
		return true
	}

	respondError(&c.Controller, http.StatusBadRequest, "verification_required", "Provide MFA code or passkey confirmation")
	return false
}

// BeginAccountActionPasskeyOptions issues a passkey challenge for sensitive actions.
func (c *UserController) BeginAccountActionPasskeyOptions() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		Action string `json:"action"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)
	action := strings.TrimSpace(strings.ToLower(body.Action))
	if action != "export" && action != "delete" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "action must be export or delete")
		return
	}

	passkeys, _ := models.NewPasskeyCRUD().ListByUserID(user.UnifiedID)
	if len(passkeys) == 0 {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "No passkeys registered")
		return
	}

	challenge := make([]byte, 32)
	if _, err := rand.Read(challenge); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate challenge")
		return
	}
	challengeB64 := base64.RawURLEncoding.EncodeToString(challenge)
	_ = models.NewPasskeyChallengeCRUD().DeleteByUserID(user.UnifiedID)
	_ = models.NewPasskeyChallengeCRUD().Create(&models.PasskeyChallenge{
		UserID:      user.UnifiedID,
		Challenge:   challengeB64,
		Type:        "account_action:" + action,
		MFAVerified: true,
		ExpiresAt:   time.Now().Add(10 * time.Minute),
		CreatedAt:   time.Now(),
	})

	allow := make([]map[string]string, 0, len(passkeys))
	for _, p := range passkeys {
		allow = append(allow, map[string]string{
			"type": "public-key",
			"id":   p.CredentialID,
		})
	}

	c.Data["json"] = map[string]interface{}{
		"publicKey": map[string]interface{}{
			"challenge":        challengeB64,
			"timeout":          60000,
			"userVerification": "preferred",
			"allowCredentials": allow,
		},
	}
	c.ServeJSON()
}

func sanitizeProvider(p models.OAuthProvider) map[string]interface{} {
	return map[string]interface{}{
		"provider":    p.Provider,
		"external_id": p.ExternalID,
		"added_at":    p.AddedAt,
	}
}

// ExportAccountData returns a privacy export for the authenticated user (without secrets).
func (c *UserController) ExportAccountData() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	req := parseAccountActionRequest(c)
	if !verifySensitiveAction(c, user, "export", req) {
		return
	}

	providers := make([]map[string]interface{}, 0, len(user.OAuthProviders))
	for _, p := range user.OAuthProviders {
		providers = append(providers, sanitizeProvider(p))
	}

	sessions, _ := models.NewSessionCRUD().GetUserSessions(user.UnifiedID)
	sessionRows := make([]map[string]interface{}, 0, len(sessions))
	for _, s := range sessions {
		sessionRows = append(sessionRows, map[string]interface{}{
			"id":                      s.ID.Hex(),
			"created_at":              s.CreatedAt,
			"expires_at":              s.ExpiresAt,
			"refresh_expires_at":      s.RefreshExpiresAt,
			"refresh_duration_months": s.RefreshDurationMonths,
			"last_used_at":            s.LastUsedAt,
			"ip_address":              s.IPAddress,
			"user_agent":              s.UserAgent,
			"country":                 s.Country,
			"city":                    s.City,
		})
	}

	passkeys, _ := models.NewPasskeyCRUD().ListByUserID(user.UnifiedID)
	passkeyRows := make([]map[string]interface{}, 0, len(passkeys))
	for _, p := range passkeys {
		passkeyRows = append(passkeyRows, map[string]interface{}{
			"id":           p.ID.Hex(),
			"name":         p.Name,
			"device_type":  p.DeviceType,
			"transports":   p.Transports,
			"created_at":   p.CreatedAt,
			"last_used_at": p.LastUsedAt,
		})
	}

	serviceApps, _ := models.NewServiceAppCRUD().ListByOwner(user.UnifiedID)
	appRows := make([]map[string]interface{}, 0, len(serviceApps))
	for _, app := range serviceApps {
		appRows = append(appRows, map[string]interface{}{
			"id":           app.ID.Hex(),
			"name":         app.Name,
			"token_prefix": app.TokenPrefix,
			"created_at":   app.CreatedAt,
			"revoked_at":   app.RevokedAt,
		})
	}

	siteConnections, _ := models.NewUserSiteConnectionCRUD().GetUserConnections(user.UnifiedID)

	c.Ctx.Output.Header("Content-Type", "application/json")
	c.Ctx.Output.Header("Content-Disposition", `attachment; filename="neo-id-export-`+time.Now().UTC().Format("20060102-150405")+`.json"`)
	c.Data["json"] = map[string]interface{}{
		"exported_at": time.Now().UTC(),
		"user": map[string]interface{}{
			"unified_id":              user.UnifiedID,
			"email":                   user.Email,
			"pending_email":           user.PendingEmail,
			"email_verified":          user.EmailVerified,
			"display_name":            user.DisplayName,
			"avatar":                  user.Avatar,
			"role":                    user.Role,
			"first_name":              user.FirstName,
			"last_name":               user.LastName,
			"location":                user.Location,
			"bio":                     user.Bio,
			"totp_enabled":            user.TOTPEnabled,
			"email_mfa_enabled":       user.EmailMFAEnabled,
			"refresh_duration_months": user.RefreshDurationMonths,
			"connected_services":      user.ConnectedServices,
			"created_at":              user.CreatedAt,
			"updated_at":              user.UpdatedAt,
			"last_login":              user.LastLogin,
		},
		"oauth_providers":         providers,
		"sessions":                sessionRows,
		"passkeys":                passkeyRows,
		"service_apps":            appRows,
		"active_site_connections": siteConnections,
		"note":                    "Passwords, OAuth access tokens, refresh tokens, TOTP secret, service app token hashes, and passkey public keys are excluded.",
	}
	c.ServeJSON()
}

// DeleteAccount deletes the authenticated account and all directly owned user data.
func (c *UserController) DeleteAccount() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	req := parseAccountActionRequest(c)
	if !verifySensitiveAction(c, user, "delete", req) {
		return
	}

	if err := models.NewServiceAppCRUD().DeleteByOwner(user.UnifiedID); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete service apps")
		return
	}

	// Remove passkeys and registration challenges.
	if _, err := models.GetCollection(models.PasskeysCollection).DeleteMany(c.Ctx.Request.Context(), bson.M{"user_id": user.UnifiedID}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete passkeys")
		return
	}
	if _, err := models.GetCollection(models.PasskeyChallengesCollection).DeleteMany(c.Ctx.Request.Context(), bson.M{"user_id": user.UnifiedID}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete passkey challenges")
		return
	}

	// Remove auth and MFA artifacts.
	if _, err := models.GetCollection(models.MFACodesCollection).DeleteMany(c.Ctx.Request.Context(), bson.M{"$or": []bson.M{{"user_id": user.UnifiedID}, {"email": strings.ToLower(strings.TrimSpace(user.Email))}}}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete mfa codes")
		return
	}
	if _, err := models.GetCollection(models.AuthCodesCollection).DeleteMany(c.Ctx.Request.Context(), bson.M{"user_id": user.UnifiedID}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete auth codes")
		return
	}

	// Remove legal notification events for this account.
	if _, err := models.GetCollection(models.LegalNoticeEventsCollection).DeleteMany(c.Ctx.Request.Context(), bson.M{"user_id": user.UnifiedID}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete legal events")
		return
	}

	// Remove service connection records.
	if _, err := models.GetCollection("user_site_connections").DeleteMany(c.Ctx.Request.Context(), bson.M{"user_id": user.UnifiedID}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete site connections")
		return
	}

	// Remove developer-owned sites by owner_id or owner_email for complete deletion.
	ownerEmail := strings.ToLower(strings.TrimSpace(user.Email))
	if _, err := models.GetCollection(models.SitesCollection).DeleteMany(c.Ctx.Request.Context(), bson.M{"$or": []bson.M{{"owner_id": user.UnifiedID}, {"owner_email": ownerEmail}}}); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete owned sites")
		return
	}

	if err := models.NewSessionCRUD().DeleteUserSessions(user.UnifiedID); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete sessions")
		return
	}
	if err := models.NewUserCRUD().DeleteByUnifiedID(user.UnifiedID); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete user")
		return
	}

	c.Data["json"] = map[string]interface{}{"deleted": true, "mode": "full"}
	c.ServeJSON()
}
