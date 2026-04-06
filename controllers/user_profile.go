package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"unified-id/models"

	"golang.org/x/crypto/bcrypt"
)

// GetProfile returns the authenticated user's profile.
func (c *UserController) GetProfile() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	// migrate legacy provider if needed
	if len(user.OAuthProviders) == 0 && user.Provider != "" {
		user.OAuthProviders = append(user.OAuthProviders, models.OAuthProvider{
			Provider:    user.Provider,
			ExternalID:  user.ExternalID,
			AccessToken: user.AccessToken,
			AddedAt:     time.Now(),
		})
		user.Provider = ""
		user.ExternalID = ""
		user.AccessToken = ""
		_ = models.NewUserCRUD().UpdateUser(user)
	}

	c.Data["json"] = map[string]interface{}{
		"unified_id":         user.UnifiedID,
		"email":              user.Email,
		"display_name":       user.DisplayName,
		"avatar":             user.Avatar,
		"role":               user.Role,
		"oauth_providers":    user.OAuthProviders,
		"has_password":       user.PasswordHash != "",
		"first_name":         user.FirstName,
		"last_name":          user.LastName,
		"location":           user.Location,
		"bio":                user.Bio,
		"connected_services": user.ConnectedServices,
		"created_at":         user.CreatedAt,
		"last_login":         user.LastLogin,
	}
	c.ServeJSON()
}

// UpdateProfile updates user profile fields.
func (c *UserController) UpdateProfile() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var updateData struct {
		DisplayName string `json:"display_name"`
		FirstName   string `json:"first_name"`
		LastName    string `json:"last_name"`
		Location    string `json:"location"`
		Bio         string `json:"bio"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &updateData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if updateData.DisplayName != "" {
		user.DisplayName = updateData.DisplayName
	}
	if updateData.FirstName != "" {
		user.FirstName = updateData.FirstName
	}
	if updateData.LastName != "" {
		user.LastName = updateData.LastName
	}
	if updateData.Location != "" {
		user.Location = updateData.Location
	}
	if updateData.Bio != "" {
		user.Bio = updateData.Bio
	}

	userCRUD := models.NewUserCRUD()
	if err := userCRUD.UpdateUser(user); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to update profile: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Profile updated successfully",
		"user": map[string]interface{}{
			"unified_id":   user.UnifiedID,
			"display_name": user.DisplayName,
			"first_name":   user.FirstName,
			"last_name":    user.LastName,
			"location":     user.Location,
			"bio":          user.Bio,
		},
	}
	c.ServeJSON()
}

// SetAvatar sets avatar from a stock URL or uploads file to ImageKit.
func (c *UserController) SetAvatar() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	file, header, uploadErr := c.Ctx.Request.FormFile("avatar")
	if uploadErr == nil {
		defer file.Close()

		ct := header.Header.Get("Content-Type")
		if !strings.HasPrefix(ct, "image/") {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "file must be an image")
			return
		}
		if header.Size > 5*1024*1024 {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "file too large (max 5MB)")
			return
		}

		ext := ".jpg"
		switch ct {
		case "image/png":
			ext = ".png"
		case "image/gif":
			ext = ".gif"
		case "image/webp":
			ext = ".webp"
		}

		imgData, err := io.ReadAll(file)
		if err != nil {
			respondError(&c.Controller, http.StatusInternalServerError, "server_error", "failed to read file")
			return
		}

		filename := "avatar_" + user.UnifiedID + ext
		avatarURL, err := uploadToImageKit(imgData, filename)
		if err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
			c.Data["json"] = map[string]interface{}{"error": "upload failed: " + err.Error()}
			c.ServeJSON()
			return
		}

		user.Avatar = avatarURL
		_ = models.NewUserCRUD().UpdateUser(user)
		c.Data["json"] = map[string]interface{}{"avatar": avatarURL}
		c.ServeJSON()
		return
	}

	var body struct {
		AvatarURL string `json:"avatar_url"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	avatarURL := strings.TrimSpace(body.AvatarURL)
	if avatarURL == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "avatar_url or file required")
		return
	}
	if !strings.HasPrefix(avatarURL, "/avatars/") && !strings.HasPrefix(avatarURL, "https://") {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid avatar_url")
		return
	}

	user.Avatar = avatarURL
	_ = models.NewUserCRUD().UpdateUser(user)
	c.Data["json"] = map[string]interface{}{"avatar": avatarURL}
	c.ServeJSON()
}

// CompleteProfile sets display_name and avatar in one call (used after registration).
func (c *UserController) CompleteProfile() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		DisplayName string `json:"display_name"`
		AvatarURL   string `json:"avatar_url"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if strings.TrimSpace(body.DisplayName) != "" {
		user.DisplayName = strings.TrimSpace(body.DisplayName)
	}
	if strings.TrimSpace(body.AvatarURL) != "" {
		user.Avatar = strings.TrimSpace(body.AvatarURL)
	}

	_ = models.NewUserCRUD().UpdateUser(user)
	c.Data["json"] = map[string]interface{}{
		"display_name": user.DisplayName,
		"avatar":       user.Avatar,
	}
	c.ServeJSON()
}

// SetPassword sets or changes the user's password with optional MFA verification.
func (c *UserController) SetPassword() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var requestData struct {
		Password        string `json:"password"`
		CurrentPassword string `json:"current_password"`
		MFACode         string `json:"mfa_code"`
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
	if requestData.Password == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "password is required")
		return
	}

	if user.PasswordHash != "" {
		if requestData.CurrentPassword == "" {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "current_password is required")
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(requestData.CurrentPassword)); err != nil {
			respondError(&c.Controller, http.StatusUnauthorized, "invalid_request", "invalid current password")
			return
		}
	}

	if user.TOTPEnabled || user.EmailMFAEnabled {
		code := strings.TrimSpace(requestData.MFACode)
		if code == "" {
			mfaType := "totp"
			if !user.TOTPEnabled && user.EmailMFAEnabled {
				mfaType = "email"
				mfaCode, _ := generateEmailVerificationCode()
				mfaCRUD := models.NewMFACodeCRUD()
				_ = mfaCRUD.DeleteByEmail(user.Email)
				exp := time.Now().Add(10 * time.Minute)
				_ = mfaCRUD.Create(&models.MFACode{
					UserID:    user.UnifiedID,
					Email:     user.Email,
					Code:      mfaCode,
					ExpiresAt: exp,
				})
				htmlBody := buildMFACodeHTML(mfaCode)
				_ = sendResendEmail(user.Email, "Confirm password change", htmlBody)
			}
			c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
			c.Data["json"] = map[string]interface{}{
				"error":    "mfa_required",
				"mfa_type": mfaType,
			}
			c.ServeJSON()
			return
		}

		if user.TOTPEnabled {
			if !verifyTOTPCode(code, user.TOTPSecret) {
				if user.EmailMFAEnabled {
					if !verifyEmailMFACode(user.Email, code) {
						respondError(&c.Controller, http.StatusUnauthorized, "invalid_request", "invalid MFA code")
						return
					}
				} else {
					respondError(&c.Controller, http.StatusUnauthorized, "invalid_request", "invalid TOTP code")
					return
				}
			}
		} else if user.EmailMFAEnabled {
			if !verifyEmailMFACode(user.Email, code) {
				respondError(&c.Controller, http.StatusUnauthorized, "invalid_request", "invalid MFA code")
				return
			}
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(requestData.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "failed to hash password")
		return
	}

	user.PasswordHash = string(hash)
	if err := models.NewUserCRUD().UpdateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "failed to set password")
		return
	}

	currentToken := strings.TrimPrefix(c.Ctx.Request.Header.Get("Authorization"), "Bearer ")
	if currentToken != "" {
		_ = models.NewSessionCRUD().DeleteUserSessionsExcept(user.UnifiedID, currentToken)
	}

	c.Data["json"] = map[string]interface{}{"message": "password set"}
	c.ServeJSON()
}

// GetProviders returns the user's linked OAuth providers.
func (c *UserController) GetProviders() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	if len(user.OAuthProviders) == 0 && user.Provider != "" {
		user.OAuthProviders = append(user.OAuthProviders, models.OAuthProvider{
			Provider:    user.Provider,
			ExternalID:  user.ExternalID,
			AccessToken: user.AccessToken,
			AddedAt:     time.Now(),
		})
		user.Provider = ""
		user.ExternalID = ""
		user.AccessToken = ""
		_ = models.NewUserCRUD().UpdateUser(user)
	}

	c.Data["json"] = map[string]interface{}{
		"oauth_providers": user.OAuthProviders,
		"has_password":    user.PasswordHash != "",
	}
	c.ServeJSON()
}

// UnlinkProvider removes a linked OAuth provider from the user's account.
func (c *UserController) UnlinkProvider() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var requestData struct {
		Provider string `json:"provider"`
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
	if requestData.Provider == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "provider is required")
		return
	}

	if len(user.OAuthProviders) == 0 && user.Provider != "" {
		user.OAuthProviders = append(user.OAuthProviders, models.OAuthProvider{
			Provider:    user.Provider,
			ExternalID:  user.ExternalID,
			AccessToken: user.AccessToken,
			AddedAt:     time.Now(),
		})
		user.Provider = ""
		user.ExternalID = ""
		user.AccessToken = ""
	}

	filtered := make([]models.OAuthProvider, 0, len(user.OAuthProviders))
	removed := false
	for _, p := range user.OAuthProviders {
		if p.Provider == requestData.Provider {
			removed = true
			continue
		}
		filtered = append(filtered, p)
	}
	if !removed {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "provider not linked")
		return
	}

	if len(filtered) == 0 && user.PasswordHash == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "cannot unlink the last provider without setting a password")
		return
	}

	user.OAuthProviders = filtered
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.UpdateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "failed to unlink provider")
		return
	}

	_ = models.NewSessionCRUD().DeleteUserSessions(user.UnifiedID)

	c.Data["json"] = map[string]interface{}{"message": "provider unlinked"}
	c.ServeJSON()
}
