package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"golang.org/x/crypto/bcrypt"
)

type UserController struct {
	web.Controller
}

// Middleware to authenticate user
func (c *UserController) authenticateUser() (*models.User, error) {
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" {
		return nil, nil // No token provided
	}

	// Validate JWT token
	claims := &Claims{}
	jwtToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(secret) == "" {
			secret = web.AppConfig.DefaultString("jwt_secret", "")
		}
		return []byte(secret), nil
	})

	if err != nil || !jwtToken.Valid {
		return nil, nil // Invalid token
	}

	// Check if session exists
	sessionCRUD := models.NewSessionCRUD()
	session, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || session == nil {
		// Session not found or expired (common after DB switch or logout)
		return nil, nil
	}

	// Get user
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		return nil, nil // User not found
	}

	// Check if user is banned
	if user.IsBanned {
		if user.BannedUntil != nil && time.Now().After(*user.BannedUntil) {
			// Ban expired, unban user
			userCRUD.UnbanUser(user.UnifiedID)
			user.IsBanned = false
		} else {
			return nil, nil // User is banned
		}
	}

	return user, nil
}

// GetProfile returns user profile
func (c *UserController) GetProfile() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
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

func (c *UserController) isDeveloper(user *models.User) bool {
	if user == nil {
		return false
	}
	role := strings.ToLower(strings.TrimSpace(user.Role))
	return role == "developer" || role == "admin" || role == "moderator"
}

// CreateServiceApp allows Developer to generate a token for a service/app
func (c *UserController) CreateServiceApp() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}
	if !c.isDeveloper(user) {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{"error": "Developer role required"}
		c.ServeJSON()
		return
	}

	var requestData struct {
		Name string `json:"name"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}
	if strings.TrimSpace(requestData.Name) == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "name is required"}
		c.ServeJSON()
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

func (c *UserController) ListServiceApps() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}
	if !c.isDeveloper(user) {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{"error": "Developer role required"}
		c.ServeJSON()
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

func (c *UserController) RevokeServiceApp() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}
	if !c.isDeveloper(user) {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{"error": "Developer role required"}
		c.ServeJSON()
		return
	}

	var requestData struct {
		ID string `json:"id"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}
	if strings.TrimSpace(requestData.ID) == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "id is required"}
		c.ServeJSON()
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

func (c *UserController) DeleteServiceApp() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}
	if !c.isDeveloper(user) {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{"error": "Developer role required"}
		c.ServeJSON()
		return
	}

	var requestData struct {
		ID string `json:"id"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}
	if strings.TrimSpace(requestData.ID) == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "id is required"}
		c.ServeJSON()
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

func (c *UserController) GetProviders() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
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

func (c *UserController) UnlinkProvider() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	var requestData struct {
		Provider string `json:"provider"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}
	if requestData.Provider == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "provider is required"}
		c.ServeJSON()
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
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		c.Data["json"] = map[string]interface{}{"error": "provider not linked"}
		c.ServeJSON()
		return
	}

	// Safety: after unlink, user must have at least 1 provider OR password
	if len(filtered) == 0 && user.PasswordHash == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "cannot unlink the last provider without setting a password"}
		c.ServeJSON()
		return
	}

	user.OAuthProviders = filtered
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.UpdateUser(user); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "failed to unlink provider"}
		c.ServeJSON()
		return
	}

	// invalidate sessions to be safe
	_ = models.NewSessionCRUD().DeleteUserSessions(user.UnifiedID)

	c.Data["json"] = map[string]interface{}{"message": "provider unlinked"}
	c.ServeJSON()
}

func (c *UserController) SetPassword() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	var requestData struct {
		Password        string `json:"password"`
		CurrentPassword string `json:"current_password"`
		MFACode         string `json:"mfa_code"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}
	if requestData.Password == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "password is required"}
		c.ServeJSON()
		return
	}

	// Verify current password if set
	if user.PasswordHash != "" {
		if requestData.CurrentPassword == "" {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "current_password is required"}
			c.ServeJSON()
			return
		}
		if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(requestData.CurrentPassword)); err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
			c.Data["json"] = map[string]interface{}{"error": "invalid current password"}
			c.ServeJSON()
			return
		}
	}

	// MFA verification required for password change
	if user.TOTPEnabled || user.EmailMFAEnabled {
		code := strings.TrimSpace(requestData.MFACode)
		if code == "" {
			// Tell client which MFA type to use
			mfaType := "totp"
			if !user.TOTPEnabled && user.EmailMFAEnabled {
				mfaType = "email"
				// Send email code
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

		// Verify the provided code
		if user.TOTPEnabled {
			if !verifyTOTPCode(code, user.TOTPSecret) {
				// If TOTP fails and email MFA also enabled, try email code
				if user.EmailMFAEnabled {
					if !verifyEmailMFACode(user.Email, code) {
						c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
						c.Data["json"] = map[string]interface{}{"error": "invalid MFA code"}
						c.ServeJSON()
						return
					}
				} else {
					c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
					c.Data["json"] = map[string]interface{}{"error": "invalid TOTP code"}
					c.ServeJSON()
					return
				}
			}
		} else if user.EmailMFAEnabled {
			if !verifyEmailMFACode(user.Email, code) {
				c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
				c.Data["json"] = map[string]interface{}{"error": "invalid MFA code"}
				c.ServeJSON()
				return
			}
		}
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(requestData.Password), bcrypt.DefaultCost)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "failed to hash password"}
		c.ServeJSON()
		return
	}

	user.PasswordHash = string(hash)
	if err := models.NewUserCRUD().UpdateUser(user); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "failed to set password"}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"message": "password set"}
	c.ServeJSON()
}

// UpdateProfile updates user profile
func (c *UserController) UpdateProfile() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
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
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to read request body",
		}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &updateData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	// Update user fields
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

	// Save changes
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.UpdateUser(user); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to update profile: " + err.Error(),
		}
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

// GetConnectedServices returns user's connected services
func (c *UserController) GetConnectedServices() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	// Get all available services from services collection
	serviceCRUD := models.NewServiceCRUD()
	allServices, err := serviceCRUD.GetAllActiveServices()
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to get services: " + err.Error()}
		c.ServeJSON()
		return
	}

	// Also include registered sites as connectable services
	siteCRUD := models.NewSiteCRUD()
	allSites, _ := siteCRUD.GetAllActiveSites()

	// Build a set of connected service names
	connectedSet := map[string]bool{}
	for _, s := range user.ConnectedServices {
		connectedSet[s] = true
	}

	var connectedServices []map[string]interface{}
	var availableServices []map[string]interface{}

	// Regular services
	for _, service := range allServices {
		info := map[string]interface{}{
			"name":         service.Name,
			"display_name": service.DisplayName,
			"description":  service.Description,
			"logo_url":     service.LogoURL,
			"type":         "service",
		}
		if connectedSet[service.Name] {
			connectedServices = append(connectedServices, info)
		} else {
			availableServices = append(availableServices, info)
		}
	}

	// Sites (registered apps like NeoMovies)
	for _, site := range allSites {
		info := map[string]interface{}{
			"name":         site.Name,
			"display_name": site.Name,
			"description":  site.Description,
			"logo_url":     site.LogoURL,
			"type":         "site",
			"domain":       site.Domain,
		}
		if connectedSet[site.Name] {
			connectedServices = append(connectedServices, info)
		}
		// Sites are not shown as "available" — they appear only when connected
	}

	if connectedServices == nil {
		connectedServices = []map[string]interface{}{}
	}
	if availableServices == nil {
		availableServices = []map[string]interface{}{}
	}

	c.Data["json"] = map[string]interface{}{
		"connected_services": connectedServices,
		"available_services": availableServices,
	}
	c.ServeJSON()
}

// ConnectService connects a service to user account
func (c *UserController) ConnectService() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		ServiceName string `json:"service_name"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to read request body",
		}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	// Validate service exists
	serviceCRUD := models.NewServiceCRUD()
	service, err := serviceCRUD.GetServiceByName(requestData.ServiceName)
	if err != nil || service == nil || !service.IsActive {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		c.Data["json"] = map[string]interface{}{
			"error": "Service not found or inactive",
		}
		c.ServeJSON()
		return
	}

	// Check if already connected
	for _, connectedService := range user.ConnectedServices {
		if connectedService == requestData.ServiceName {
			c.Data["json"] = map[string]interface{}{
				"error": "Service already connected",
			}
			c.ServeJSON()
			return
		}
	}

	// Connect service
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.AddConnectedService(user.UnifiedID, requestData.ServiceName); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to connect service: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Service connected successfully",
		"service": requestData.ServiceName,
	}
	c.ServeJSON()
}

// DisconnectService disconnects a service from user account
func (c *UserController) DisconnectService() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		ServiceName string `json:"service_name"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to read request body",
		}
		c.ServeJSON()
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	// Check if service is connected
	isConnected := false
	for _, connectedService := range user.ConnectedServices {
		if connectedService == requestData.ServiceName {
			isConnected = true
			break
		}
	}

	if !isConnected {
		c.Data["json"] = map[string]interface{}{
			"error": "Service not connected",
		}
		c.ServeJSON()
		return
	}

	// Disconnect service
	userCRUD := models.NewUserCRUD()
	if err := userCRUD.RemoveConnectedService(user.UnifiedID, requestData.ServiceName); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to disconnect service: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Also remove from user_site_connections if it's a registered site
	siteCRUD := models.NewSiteCRUD()
	if sites, err := siteCRUD.GetAllActiveSites(); err == nil {
		for _, site := range sites {
			if site.Name == requestData.ServiceName {
				connCRUD := models.NewUserSiteConnectionCRUD()
				_ = connCRUD.DisconnectUserFromSite(user.UnifiedID, site.SiteID)
				break
			}
		}
	}

	// Notify service via webhook (async) — e.g. to delete the user account on their side
	go notifyServiceDisconnect(requestData.ServiceName, user.UnifiedID, user.Email)

	c.Data["json"] = map[string]interface{}{
		"message": "Service disconnected successfully",
		"service": requestData.ServiceName,
	}
	c.ServeJSON()
}

// uploadToImageKit uploads image bytes to ImageKit and returns the CDN URL
func uploadToImageKit(data []byte, filename string) (string, error) {
	privateKey := strings.TrimSpace(os.Getenv("IMAGEKIT_PRIVATE_KEY"))
	if privateKey == "" {
		privateKey = strings.TrimSpace(web.AppConfig.DefaultString("imagekit_private_key", ""))
	}
	if privateKey == "" {
		return "", fmt.Errorf("IMAGEKIT_PRIVATE_KEY not configured")
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	// file field
	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err = fw.Write(data); err != nil {
		return "", err
	}
	// fileName field
	_ = w.WriteField("fileName", filename)
	// folder
	_ = w.WriteField("folder", "/avatars")
	// useUniqueFileName
	_ = w.WriteField("useUniqueFileName", "true")
	w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://upload.imagekit.io/api/v1/files/upload", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.SetBasicAuth(privateKey, "")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("imagekit error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var result struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.URL == "" {
		return "", fmt.Errorf("imagekit: unexpected response: %s", string(body))
	}
	return result.URL, nil
}

// SetAvatar sets avatar from a stock URL or uploads file to ImageKit
func (c *UserController) SetAvatar() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	// Try multipart upload first
	file, header, uploadErr := c.Ctx.Request.FormFile("avatar")
	if uploadErr == nil {
		defer file.Close()

		ct := header.Header.Get("Content-Type")
		if !strings.HasPrefix(ct, "image/") {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "file must be an image"}
			c.ServeJSON()
			return
		}
		if header.Size > 5*1024*1024 {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "file too large (max 5MB)"}
			c.ServeJSON()
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
			c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
			c.Data["json"] = map[string]interface{}{"error": "failed to read file"}
			c.ServeJSON()
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

	// JSON body — stock avatar URL (relative /avatars/ path)
	var body struct {
		AvatarURL string `json:"avatar_url"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	avatarURL := strings.TrimSpace(body.AvatarURL)
	if avatarURL == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "avatar_url or file required"}
		c.ServeJSON()
		return
	}
	if !strings.HasPrefix(avatarURL, "/avatars/") && !strings.HasPrefix(avatarURL, "https://") {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "invalid avatar_url"}
		c.ServeJSON()
		return
	}

	user.Avatar = avatarURL
	_ = models.NewUserCRUD().UpdateUser(user)
	c.Data["json"] = map[string]interface{}{"avatar": avatarURL}
	c.ServeJSON()
}

// CompleteProfile sets display_name and avatar in one call (used after registration)
func (c *UserController) CompleteProfile() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
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

// ToggleEmailMFA enables or disables email MFA for login
func (c *UserController) ToggleEmailMFA() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
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

// GetSessions returns all active sessions for the current user
func (c *UserController) GetSessions() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	sessions, err := sessionCRUD.GetUserSessions(user.UnifiedID)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to get sessions"}
		c.ServeJSON()
		return
	}

	// Get current token to mark current session
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

// RevokeSession revokes a specific session by ID
func (c *UserController) RevokeSession() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	var body struct {
		ID string `json:"id"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if body.ID == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "id is required"}
		c.ServeJSON()
		return
	}

	oid, err := primitive.ObjectIDFromHex(body.ID)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "invalid id"}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	if err := sessionCRUD.RevokeSessionByID(oid, user.UnifiedID); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to revoke session"}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"revoked": true}
	c.ServeJSON()
}

// SetRefreshDuration sets the preferred refresh token duration for all new sessions
func (c *UserController) SetRefreshDuration() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	var body struct {
		Months int `json:"months"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if body.Months < 1 || body.Months > 9 {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "months must be between 1 and 9"}
		c.ServeJSON()
		return
	}

	user.RefreshDurationMonths = body.Months
	_ = models.NewUserCRUD().UpdateUser(user)

	// Apply new duration to all existing active sessions
	_ = models.NewSessionCRUD().UpdateAllSessionsDuration(user.UnifiedID, body.Months)

	c.Data["json"] = map[string]interface{}{"refresh_duration_months": user.RefreshDurationMonths}
	c.ServeJSON()
}

// verifyTOTPCode checks a TOTP code against a secret
func verifyTOTPCode(code, secret string) bool {
	if secret == "" {
		return false
	}
	return totpValidate(code, secret)
}

// verifyEmailMFACode checks a pending email MFA code
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

// notifyServiceDisconnect calls the service's webhook when a user disconnects it.
// The service can use this to delete the user's account on their side.
func notifyServiceDisconnect(serviceName, unifiedID, email string) {
	// Look up the site by name to get webhook URL
	siteCRUD := models.NewSiteCRUD()
	ctx := context.Background()
	cursor, err := siteCRUD.Collection().Find(ctx, bson.M{"name": serviceName})
	if err != nil {
		return
	}
	defer cursor.Close(ctx)

	var sites []models.Site
	_ = cursor.All(ctx, &sites)

	for _, site := range sites {
		if site.WebhookURL == "" {
			continue
		}
		payload, _ := json.Marshal(map[string]interface{}{
			"event":      "user.disconnected",
			"unified_id": unifiedID,
			"email":      email,
			"service":    serviceName,
		})
		req, err := http.NewRequest(http.MethodPost, site.WebhookURL, bytes.NewReader(payload))
		if err != nil {
			continue
		}
		req.Header.Set("Content-Type", "application/json")
		req.Header.Set("X-Neo-ID-Event", "user.disconnected")
		client := &http.Client{Timeout: 10 * time.Second}
		resp, err := client.Do(req)
		if err == nil {
			resp.Body.Close()
		}
	}
}
