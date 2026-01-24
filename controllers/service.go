package controllers

import (
	"encoding/json"
	"net/http"
	"strings"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
)

type ServiceController struct {
	web.Controller
}

// verifyServiceToken verifies service API token
func (c *ServiceController) verifyServiceToken() (string, error) {
	// Get service token from Authorization header
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" {
		return "", nil // No token provided
	}

	app, err := models.NewServiceAppCRUD().VerifyToken(token)
	if err != nil {
		return "", err
	}
	if app == nil {
		return "", nil
	}
	return app.Name, nil
}

// verifyUserToken verifies user JWT token
func (c *ServiceController) verifyUserToken() (*models.User, error) {
	token := c.Ctx.Request.Header.Get("X-User-Token")
	if token == "" {
		return nil, nil // No user token provided
	}

	// Validate JWT token
	claims := &Claims{}
	jwtToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		return []byte(web.AppConfig.DefaultString("jwt_secret", "")), nil
	})

	if err != nil || !jwtToken.Valid {
		return nil, nil // Invalid token
	}

	// Check if session exists
	sessionCRUD := models.NewSessionCRUD()
	session, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || session == nil {
		return nil, nil // Session not found or expired
	}

	// Get user
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		return nil, nil // User not found
	}

	// Check if user is banned
	if user.IsBanned {
		return nil, nil // User is banned
	}

	return user, nil
}

// VerifyToken verifies a user token for services
func (c *ServiceController) VerifyToken() {
	// Verify service token
	serviceName, err := c.verifyServiceToken()
	if err != nil || serviceName == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid service token",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		UserToken string `json:"user_token"`
	}

	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	if requestData.UserToken == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "user_token is required",
		}
		c.ServeJSON()
		return
	}

	// Verify user token
	user, err := c.verifyUserToken()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid user token",
		}
		c.ServeJSON()
		return
	}

	// Check if user has connected this service
	isConnected := false
	for _, connectedService := range user.ConnectedServices {
		if connectedService == serviceName {
			isConnected = true
			break
		}
	}

	if !isConnected {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{
			"error": "Service not connected to user account",
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"valid": true,
		"user": map[string]interface{}{
			"unified_id":   user.UnifiedID,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"avatar":       user.Avatar,
		},
	}
	c.ServeJSON()
}

// GetUserInfo returns user information for services
func (c *ServiceController) GetUserInfo() {
	// Verify service token
	serviceName, err := c.verifyServiceToken()
	if err != nil || serviceName == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid service token",
		}
		c.ServeJSON()
		return
	}

	// Verify user token from header
	user, err := c.verifyUserToken()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid user token",
		}
		c.ServeJSON()
		return
	}

	// Check if user has connected this service
	isConnected := false
	for _, connectedService := range user.ConnectedServices {
		if connectedService == serviceName {
			isConnected = true
			break
		}
	}

	if !isConnected {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{
			"error": "Service not connected to user account",
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"unified_id":   user.UnifiedID,
		"email":        user.Email,
		"display_name": user.DisplayName,
		"avatar":       user.Avatar,
		"first_name":   user.FirstName,
		"last_name":    user.LastName,
		"location":     user.Location,
		"bio":          user.Bio,
		"created_at":   user.CreatedAt,
	}
	c.ServeJSON()
}
