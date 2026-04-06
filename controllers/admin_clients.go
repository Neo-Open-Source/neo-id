package controllers

import (
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// AdminClientsController handles OIDC client (site) management for admins/moderators/developers.
type AdminClientsController struct {
	web.Controller
}

// requireDeveloperOrAbove authenticates the request and returns the user if they have
// role developer, moderator, or admin. Returns (user, isDeveloper, true) on success.
func requireDeveloperOrAbove(c *AdminClientsController) (*models.User, bool, bool) {
	tmp := &AdminController{Controller: c.Controller}

	// Try admin/moderator first
	user, err := tmp.authenticateAdminOrModerator()
	if err == nil && user != nil {
		return user, false, true
	}

	// Try developer
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if token == "" {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return nil, false, false
	}

	claims := &Claims{}
	jwtToken, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(secret) == "" {
			secret = web.AppConfig.DefaultString("jwt_secret", "")
		}
		return []byte(secret), nil
	})
	if err != nil || !jwtToken.Valid {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return nil, false, false
	}

	sessionCRUD := models.NewSessionCRUD()
	if sess, _ := sessionCRUD.GetSessionByToken(token); sess == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return nil, false, false
	}

	userCRUD := models.NewUserCRUD()
	u, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || u == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return nil, false, false
	}

	if strings.ToLower(strings.TrimSpace(u.Role)) == "developer" {
		return u, true, true
	}

	respondError(&c.Controller, http.StatusForbidden, "forbidden", "Forbidden - developer/admin/moderator access required")
	return nil, false, false
}

// extractOrigin returns the scheme+host origin from a URI string.
func extractOrigin(rawURI string) string {
	u, err := url.Parse(rawURI)
	if err != nil || u.Host == "" {
		return ""
	}
	return u.Scheme + "://" + u.Host
}

// CreateClient handles POST /api/admin/clients
func (c *AdminClientsController) CreateClient() {
	actor, _, ok := requireDeveloperOrAbove(c)
	if !ok {
		return
	}

	var req struct {
		Name         string   `json:"name"`
		RedirectURIs []string `json:"redirect_uris"`
		LogoURL      string   `json:"logo_url"`
		Description  string   `json:"description"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if strings.TrimSpace(req.Name) == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "name is required")
		return
	}
	if len(req.RedirectURIs) == 0 {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "redirect_uris must contain at least one URI")
		return
	}
	// Validate each redirect URI
	for _, ru := range req.RedirectURIs {
		if _, err := url.ParseRequestURI(ru); err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "invalid redirect_uri: " + ru}
			c.ServeJSON()
			return
		}
	}

	// Extract domain and allowed origins from redirect URIs
	firstURI := req.RedirectURIs[0]
	domain := ""
	if u, err := url.Parse(firstURI); err == nil && u.Host != "" {
		domain = u.Host
	} else {
		domain = firstURI
	}

	allowedOrigins := []string{}
	seen := map[string]struct{}{}
	for _, ru := range req.RedirectURIs {
		origin := extractOrigin(ru)
		if origin == "" {
			continue
		}
		if _, ok := seen[origin]; !ok {
			seen[origin] = struct{}{}
			allowedOrigins = append(allowedOrigins, origin)
		}
	}

	siteID := generateSiteID()
	apiKey := generateAPIKey()
	apiSecret := generateAPISecret()

	site := &models.Site{
		SiteID:         siteID,
		Name:           strings.TrimSpace(req.Name),
		Domain:         domain,
		APIKey:         apiKey,
		APISecret:      apiSecret,
		Description:    req.Description,
		LogoURL:        req.LogoURL,
		AllowedOrigins: allowedOrigins,
		RedirectURI:    firstURI,
		RedirectURIs:   req.RedirectURIs,
		IsActive:       true,
		OwnerID:        actor.UnifiedID,
		OwnerEmail:     actor.Email,
		Plan:           "enterprise",
	}

	siteCRUD := models.NewSiteCRUD()
	if err := siteCRUD.CreateSite(site); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to create client: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Ctx.ResponseWriter.WriteHeader(http.StatusCreated)
	c.Data["json"] = map[string]interface{}{
		"client_id":     siteID,
		"client_secret": apiSecret,
		"name":          site.Name,
		"redirect_uris": site.RedirectURIs,
	}
	c.ServeJSON()
}

// ListClients handles GET /api/admin/clients
func (c *AdminClientsController) ListClients() {
	actor, isDeveloper, ok := requireDeveloperOrAbove(c)
	if !ok {
		return
	}

	ctx := context.Background()
	siteCRUD := models.NewSiteCRUD()

	filter := bson.M{}
	if isDeveloper {
		filter["owner_id"] = actor.UnifiedID
	}

	cursor, err := siteCRUD.Collection().Find(ctx, filter, &options.FindOptions{
		Sort: bson.D{{Key: "created_at", Value: -1}},
	})
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to list clients: " + err.Error()}
		c.ServeJSON()
		return
	}
	defer cursor.Close(ctx)

	var sites []models.Site
	if err := cursor.All(ctx, &sites); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to decode clients: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"clients": sites}
	c.ServeJSON()
}

// DeleteClient handles DELETE /api/admin/clients/:client_id
func (c *AdminClientsController) DeleteClient() {
	actor, isDeveloper, ok := requireDeveloperOrAbove(c)
	if !ok {
		return
	}

	clientID := c.Ctx.Input.Param(":client_id")
	if clientID == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "client_id is required")
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(clientID)
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "client not found")
		return
	}

	if isDeveloper && site.OwnerID != actor.UnifiedID {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Forbidden - you can only delete your own clients")
		return
	}

	// Invalidate all auth codes for this client
	if err := models.NewAuthCodeCRUD().DeleteByClientID(clientID); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to invalidate auth codes: " + err.Error()}
		c.ServeJSON()
		return
	}

	if err := siteCRUD.DeleteSite(clientID); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to delete client: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"message": "deleted"}
	c.ServeJSON()
}

// UpdateClient handles PATCH /api/admin/clients/:client_id
func (c *AdminClientsController) UpdateClient() {
	actor, isDeveloper, ok := requireDeveloperOrAbove(c)
	if !ok {
		return
	}

	clientID := c.Ctx.Input.Param(":client_id")
	if clientID == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "client_id is required")
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(clientID)
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "client not found")
		return
	}

	if isDeveloper && site.OwnerID != actor.UnifiedID {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Forbidden - you can only update your own clients")
		return
	}

	var req struct {
		Name         *string  `json:"name"`
		RedirectURIs []string `json:"redirect_uris"`
		LogoURL      *string  `json:"logo_url"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &req); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if req.Name != nil && strings.TrimSpace(*req.Name) != "" {
		site.Name = strings.TrimSpace(*req.Name)
	}
	if req.LogoURL != nil {
		site.LogoURL = *req.LogoURL
	}
	if len(req.RedirectURIs) > 0 {
		// Validate each URI
		for _, ru := range req.RedirectURIs {
			if _, err := url.ParseRequestURI(ru); err != nil {
				c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
				c.Data["json"] = map[string]interface{}{"error": "invalid redirect_uri: " + ru}
				c.ServeJSON()
				return
			}
		}
		site.RedirectURIs = req.RedirectURIs
		site.RedirectURI = req.RedirectURIs[0]

		// Rebuild allowed origins
		allowedOrigins := []string{}
		seen := map[string]struct{}{}
		for _, ru := range req.RedirectURIs {
			origin := extractOrigin(ru)
			if origin == "" {
				continue
			}
			if _, ok := seen[origin]; !ok {
				seen[origin] = struct{}{}
				allowedOrigins = append(allowedOrigins, origin)
			}
		}
		site.AllowedOrigins = allowedOrigins
	}

	if err := siteCRUD.UpdateSite(site); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to update client: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = site
	c.ServeJSON()
}
