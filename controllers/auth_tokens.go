package controllers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// generateState generates a random OAuth state parameter
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

// firstNonEmpty returns the first non-empty string from the given values
func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

// generateUnifiedID generates a new unique user ID
func generateUnifiedID() string {
	return "uid_" + uuid.New().String()
}

// generateTokensWithDuration generates access + refresh tokens with given refresh duration in months
func generateTokensWithDuration(unifiedID, email string, refreshMonths int) (accessToken, refreshToken string, refreshExp time.Time, err error) {
	jwtSecret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", "default-secret-key"))

	if refreshMonths < 1 {
		refreshMonths = 1
	}
	if refreshMonths > 9 {
		refreshMonths = 9
	}

	// Access token — 24 hours
	accessClaims := &Claims{
		UnifiedID: unifiedID,
		Email:     email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	aTok := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessToken, err = aTok.SignedString([]byte(jwtSecret))
	if err != nil {
		return
	}

	// Refresh token — N months
	refreshExp = time.Now().AddDate(0, refreshMonths, 0)
	refreshClaims := &Claims{
		UnifiedID: unifiedID,
		Email:     email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(refreshExp),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}
	rTok := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshToken, err = rTok.SignedString([]byte(jwtSecret))
	return
}

// generateTokens is the legacy wrapper — defaults to 1 month refresh
func generateTokens(unifiedID, email string) (string, string, error) {
	a, r, _, err := generateTokensWithDuration(unifiedID, email, 1)
	return a, r, err
}

// RefreshToken refreshes JWT token with rolling refresh — extends refresh token on each use
func (c *AuthController) RefreshToken() {
	var requestBody struct {
		RefreshToken string `json:"refresh_token"`
	}

	body, _ := io.ReadAll(c.Ctx.Request.Body)
	if err := json.Unmarshal(body, &requestBody); err != nil || requestBody.RefreshToken == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "refresh_token is required")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	sess, err := sessionCRUD.GetSessionByRefreshToken(requestBody.RefreshToken)
	if err != nil || sess == nil {
		// Security: refresh tokens must map to an existing session record.
		// This prevents revoked sessions from being recreated via old JWT refresh tokens.
		respondError(&c.Controller, http.StatusUnauthorized, "invalid_request", "Invalid or expired refresh token")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(sess.UserID)
	if err != nil || user == nil || user.IsBanned {
		respondError(&c.Controller, http.StatusUnauthorized, "not_found", "User not found or banned")
		return
	}

	months := sess.RefreshDurationMonths
	if months < 1 {
		months = 1
	}

	newAccess, newRefresh, newRefreshExp, err := generateTokensWithDuration(user.UnifiedID, user.Email, months)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate tokens")
		return
	}

	_ = sessionCRUD.DeleteSession(sess.Token)
	newSess := &models.Session{
		Token:                 newAccess,
		UserID:                user.UnifiedID,
		ExpiresAt:             time.Now().Add(24 * time.Hour),
		IPAddress:             getRealIP(c.Ctx.Request),
		UserAgent:             c.Ctx.Request.UserAgent(),
		RefreshToken:          newRefresh,
		RefreshExpiresAt:      newRefreshExp,
		RefreshDurationMonths: months,
		LastUsedAt:            time.Now(),
	}
	enforceSessionLimit(user.UnifiedID)
	_ = sessionCRUD.CreateSession(newSess)

	c.Data["json"] = map[string]interface{}{
		"access_token":  newAccess,
		"refresh_token": newRefresh,
	}
	c.ServeJSON()
}

// Logout handles user logout
func (c *AuthController) Logout() {
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" {
		c.Data["json"] = map[string]interface{}{"error": "Token is required"}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	if err := sessionCRUD.DeleteSession(token); err != nil {
		c.Data["json"] = map[string]interface{}{"error": "Failed to delete session: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"message": "Logged out successfully"}
	c.ServeJSON()
}

// Health returns the service health status and version.
// GET /api/health
func (c *AuthController) Health() {
	version := os.Getenv("VERSION")
	if version == "" {
		version = "1.0.0"
	}
	c.Data["json"] = map[string]interface{}{
		"status":  "ok",
		"version": version,
	}
	c.ServeJSON()
}
