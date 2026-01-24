package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
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
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
		return
	}

	// Get all available services
	serviceCRUD := models.NewServiceCRUD()
	allServices, err := serviceCRUD.GetAllActiveServices()
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to get services: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Determine which services are connected
	var connectedServices []map[string]interface{}
	var availableServices []map[string]interface{}

	for _, service := range allServices {
		serviceInfo := map[string]interface{}{
			"name":         service.Name,
			"display_name": service.DisplayName,
			"description":  service.Description,
			"logo_url":     service.LogoURL,
		}

		isConnected := false
		for _, connectedService := range user.ConnectedServices {
			if connectedService == service.Name {
				isConnected = true
				break
			}
		}

		if isConnected {
			connectedServices = append(connectedServices, serviceInfo)
		} else {
			availableServices = append(availableServices, serviceInfo)
		}
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

	c.Data["json"] = map[string]interface{}{
		"message": "Service disconnected successfully",
		"service": requestData.ServiceName,
	}
	c.ServeJSON()
}
