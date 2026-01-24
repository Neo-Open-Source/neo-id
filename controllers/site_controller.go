package controllers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// SiteController handles site management and SaaS functionality
type SiteController struct {
	web.Controller
}

// authenticateSite authenticates a site using API key
func (c *SiteController) authenticateSite() (*models.Site, error) {
	apiKey := c.Ctx.Request.Header.Get("X-API-Key")
	if apiKey == "" {
		apiKey = c.Ctx.Request.Header.Get("Authorization")
		if apiKey != "" {
			apiKey = strings.TrimPrefix(apiKey, "Bearer ")
		}
	}

	if apiKey == "" {
		return nil, nil
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteByAPIKey(apiKey)
	if err != nil || site == nil || !site.IsActive {
		return nil, nil
	}

	return site, nil
}

// RegisterSite allows new sites to register
func (c *SiteController) RegisterSite() {
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
		return
	}
	role := strings.ToLower(strings.TrimSpace(user.Role))
	if role != "developer" && role != "admin" && role != "moderator" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{
			"error": "Developer role required",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		Name        string `json:"name"`
		Domain      string `json:"domain"`
		Description string `json:"description"`
		LogoURL     string `json:"logo_url"`
		OwnerEmail  string `json:"owner_email"`
		Plan        string `json:"plan"`
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

	if requestData.Name == "" || requestData.Domain == "" || requestData.OwnerEmail == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "name, domain, and owner_email are required",
		}
		c.ServeJSON()
		return
	}

	// Normalize domain input (accept "example.com" or "https://example.com/..."; store only host)
	normalizedDomain := strings.TrimSpace(requestData.Domain)
	if strings.HasPrefix(strings.ToLower(normalizedDomain), "http://") || strings.HasPrefix(strings.ToLower(normalizedDomain), "https://") {
		if u, err := url.Parse(normalizedDomain); err == nil {
			if u.Host != "" {
				normalizedDomain = u.Host
			}
		}
	}
	if strings.Contains(normalizedDomain, "/") {
		if u, err := url.Parse("https://" + normalizedDomain); err == nil {
			if u.Host != "" {
				normalizedDomain = u.Host
			}
		}
	}

	// Debug log
	fmt.Printf("DEBUG RegisterSite: user.UnifiedID=%s, user.Role=%s, normalized role=%s\n", user.UnifiedID, user.Role, role)

	plan := strings.ToLower(strings.TrimSpace(requestData.Plan))
	// Always assign plan by role if not explicitly set to something else
	if plan == "" {
		switch role {
		case "admin":
			plan = "enterprise"
		case "moderator":
			plan = "pro"
		default:
			plan = "free"
		}
		fmt.Printf("DEBUG Assigned plan=%s for role=%s (empty input)\n", plan, role)
	} else {
		// If plan is provided, still ensure admin gets at least enterprise
		switch role {
		case "admin":
			if plan != "enterprise" {
				plan = "enterprise"
				fmt.Printf("DEBUG Overrode plan to enterprise for admin (was provided)\n")
			}
		case "moderator":
			if plan != "enterprise" && plan != "pro" {
				plan = "pro"
				fmt.Printf("DEBUG Overrode plan to pro for moderator (was provided)\n")
			}
		}
		fmt.Printf("DEBUG Using provided/overridden plan=%s for role=%s\n", plan, role)
	}

	// Generate unique site_id and API keys
	siteID := generateSiteID()
	apiKey := generateAPIKey()
	apiSecret := generateAPISecret()

	// Create site
	site := &models.Site{
		SiteID:         siteID,
		Name:           requestData.Name,
		Domain:         normalizedDomain,
		APIKey:         apiKey,
		APISecret:      apiSecret,
		Description:    requestData.Description,
		LogoURL:        requestData.LogoURL,
		AllowedOrigins: []string{"https://" + normalizedDomain, "http://localhost:3000"},
		RedirectURI:    "https://" + normalizedDomain + "/auth/callback",
		IsActive:       true,
		OwnerEmail:     requestData.OwnerEmail,
		Plan:           plan,
	}

	siteCRUD := models.NewSiteCRUD()
	if err := siteCRUD.CreateSite(site); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to create site: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Site registered successfully",
		"site": map[string]interface{}{
			"site_id":    site.SiteID,
			"name":       site.Name,
			"domain":     site.Domain,
			"api_key":    site.APIKey,
			"api_secret": site.APISecret,
			"plan":       site.Plan,
		},
	}
	c.ServeJSON()
}

// GetMySites returns sites owned by the current authenticated user
func (c *SiteController) GetMySites() {
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized",
		}
		c.ServeJSON()
		return
	}

	ctx := context.Background()
	siteCRUD := models.NewSiteCRUD()
	cur, err := siteCRUD.Collection().Find(ctx, bson.M{"owner_email": user.Email}, &options.FindOptions{Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to get sites: " + err.Error(),
		}
		c.ServeJSON()
		return
	}
	defer cur.Close(ctx)

	var sites []models.Site
	if err := cur.All(ctx, &sites); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to decode sites: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"sites": sites,
	}
	c.ServeJSON()
}

// GetSiteInfo returns site information
func (c *SiteController) GetSiteInfo() {
	site, err := c.authenticateSite()
	if err != nil || site == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid API key",
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"site": map[string]interface{}{
			"site_id":         site.SiteID,
			"name":            site.Name,
			"domain":          site.Domain,
			"description":     site.Description,
			"logo_url":        site.LogoURL,
			"allowed_origins": site.AllowedOrigins,
			"redirect_uri":    site.RedirectURI,
			"plan":            site.Plan,
			"is_active":       site.IsActive,
			"created_at":      site.CreatedAt,
		},
	}
	c.ServeJSON()
}

// SiteLogin handles login requests from integrated sites
func (c *SiteController) SiteLogin() {
	site, err := c.authenticateSite()
	if err != nil || site == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid API key",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		RedirectURL string `json:"redirect_url"`
		State       string `json:"state"`
	}

	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	// Generate login URL with site context
	loginURL := "/login?" +
		"site_id=" + site.SiteID + "&" +
		"redirect_url=" + requestData.RedirectURL + "&" +
		"site_state=" + requestData.State

	c.Data["json"] = map[string]interface{}{
		"login_url": loginURL,
		"site_id":   site.SiteID,
	}
	c.ServeJSON()
}

// SiteCallback handles OAuth callback for integrated sites
func (c *SiteController) SiteCallback() {
	siteID := c.GetString("site_id")
	redirectURL := c.GetString("redirect_url")
	state := c.GetString("state")

	if siteID == "" || redirectURL == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "site_id and redirect_url are required",
		}
		c.ServeJSON()
		return
	}

	// Verify site exists
	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(siteID)
	if err != nil || site == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		c.Data["json"] = map[string]interface{}{
			"error": "Site not found",
		}
		c.ServeJSON()
		return
	}

	// Get user info from session (user should be authenticated by now)
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "User not authenticated",
		}
		c.ServeJSON()
		return
	}

	// Connect user to site
	connectionCRUD := models.NewUserSiteConnectionCRUD()
	if err := connectionCRUD.ConnectUserToSite(user.UnifiedID, siteID, site.Name); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to connect user to site: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Generate site-specific token
	siteToken, err := c.generateSiteToken(user.UnifiedID, siteID)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to generate site token: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Redirect back to site with token
	redirectURLWithToken := redirectURL + "?token=" + siteToken + "&state=" + state
	c.Redirect(redirectURLWithToken, http.StatusTemporaryRedirect)
}

// VerifySiteToken verifies a site-specific token
func (c *SiteController) VerifySiteToken() {
	site, err := c.authenticateSite()
	if err != nil || site == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Unauthorized - invalid API key",
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		Token string `json:"token"`
	}

	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &requestData); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	// Verify and decode token
	userID, tokenSiteID, err := c.verifySiteToken(requestData.Token)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid token: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Verify token is for this site
	if tokenSiteID != site.SiteID {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{
			"error": "Token is not valid for this site",
		}
		c.ServeJSON()
		return
	}

	// Get user info
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(userID)
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		c.Data["json"] = map[string]interface{}{
			"error": "User not found",
		}
		c.ServeJSON()
		return
	}

	// Update last access
	connectionCRUD := models.NewUserSiteConnectionCRUD()
	connectionCRUD.UpdateLastAccess(userID, site.SiteID)

	c.Data["json"] = map[string]interface{}{
		"valid": true,
		"user": map[string]interface{}{
			"unified_id":   user.UnifiedID,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"avatar":       user.Avatar,
			"first_name":   user.FirstName,
			"last_name":    user.LastName,
		},
	}
	c.ServeJSON()
}

// Helper functions
func generateSiteID() string {
	// Generate unique site ID
	b := make([]byte, 16)
	rand.Read(b)
	return "site_" + base64.URLEncoding.EncodeToString(b)[:16]
}

func generateAPIKey() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "api_" + base64.URLEncoding.EncodeToString(b)[:32]
}

func generateAPISecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "secret_" + base64.URLEncoding.EncodeToString(b)[:32]
}

func (c *SiteController) getAuthenticatedUser() (*models.User, error) {
	// This should use the same authentication logic as other controllers
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" {
		return nil, nil
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
		return nil, nil
	}

	// Check if session exists
	sessionCRUD := models.NewSessionCRUD()
	session, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || session == nil {
		return nil, nil
	}

	// Get user
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		return nil, nil
	}

	return user, nil
}

func (c *SiteController) generateSiteToken(userID, siteID string) (string, error) {
	// Generate a site-specific JWT token
	claims := &struct {
		UserID string `json:"user_id"`
		SiteID string `json:"site_id"`
		jwt.RegisteredClaims
	}{
		UserID: userID,
		SiteID: siteID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	secret := os.Getenv("JWT_SECRET")
	if strings.TrimSpace(secret) == "" {
		secret = web.AppConfig.DefaultString("jwt_secret", "")
	}
	return token.SignedString([]byte(secret))
}

func (c *SiteController) verifySiteToken(tokenString string) (string, string, error) {
	// Verify and decode site-specific token
	claims := &struct {
		UserID string `json:"user_id"`
		SiteID string `json:"site_id"`
		jwt.RegisteredClaims
	}{}

	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(secret) == "" {
			secret = web.AppConfig.DefaultString("jwt_secret", "")
		}
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		return "", "", err
	}

	return claims.UserID, claims.SiteID, nil
}
