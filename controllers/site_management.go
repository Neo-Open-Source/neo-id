package controllers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"unified-id/models"

	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/mongo/options"
)

// generateSiteID generates a unique site ID.
func generateSiteID() string {
	b := make([]byte, 16)
	rand.Read(b)
	return "site_" + base64.URLEncoding.EncodeToString(b)[:16]
}

// generateAPIKey generates a unique API key.
func generateAPIKey() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "api_" + base64.URLEncoding.EncodeToString(b)[:32]
}

// generateAPISecret generates a unique API secret.
func generateAPISecret() string {
	b := make([]byte, 32)
	rand.Read(b)
	return "secret_" + base64.URLEncoding.EncodeToString(b)[:32]
}

// RegisterSite allows developers/admins to register a new site.
func (c *SiteController) RegisterSite() {
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}
	role := strings.ToLower(strings.TrimSpace(user.Role))
	if role != "developer" && role != "admin" && role != "moderator" {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Developer role required")
		return
	}

	var requestData struct {
		Name        string   `json:"name"`
		Domain      string   `json:"domain"`
		Description string   `json:"description"`
		LogoURL     string   `json:"logo_url"`
		OwnerEmail  string   `json:"owner_email"`
		Plan        string   `json:"plan"`
		Allowed     []string `json:"allowed_origins"`
		WebhookURL  string   `json:"webhook_url"`
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

	if requestData.Name == "" || requestData.Domain == "" || requestData.OwnerEmail == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "name, domain, and owner_email are required")
		return
	}

	rawDomains := strings.Split(strings.TrimSpace(requestData.Domain), ",")
	var normalizedDomains []string
	for _, d := range rawDomains {
		d = strings.TrimSpace(d)
		if d == "" {
			continue
		}
		lowerD := strings.ToLower(d)
		if strings.HasPrefix(lowerD, "http://") || strings.HasPrefix(lowerD, "https://") {
			if u, err := url.Parse(d); err == nil && u.Host != "" {
				d = u.Host
			}
		} else if strings.Contains(d, "://") {
			// custom scheme — keep as-is
		} else if strings.Contains(d, ":") && !strings.Contains(d, "/") {
			// custom scheme like "myapp:" — keep as-is
		} else if strings.Contains(d, "/") {
			if u, err := url.Parse("https://" + d); err == nil && u.Host != "" {
				d = u.Host
			}
		}
		normalizedDomains = append(normalizedDomains, d)
	}
	if len(normalizedDomains) == 0 {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "domain is required")
		return
	}
	normalizedDomain := normalizedDomains[0]

	plan := strings.ToLower(strings.TrimSpace(requestData.Plan))
	if plan == "" {
		switch role {
		case "admin":
			plan = "enterprise"
		case "moderator":
			plan = "pro"
		default:
			plan = "free"
		}
	} else {
		switch role {
		case "admin":
			if plan != "enterprise" {
				plan = "enterprise"
			}
		case "moderator":
			if plan != "enterprise" && plan != "pro" {
				plan = "pro"
			}
		}
	}

	siteID := generateSiteID()
	apiKey := generateAPIKey()
	apiSecret := generateAPISecret()

	allowedOrigins := buildAllowedOrigins(normalizedDomain)
	for _, d := range normalizedDomains[1:] {
		allowedOrigins = mergeAllowedOrigins(allowedOrigins, buildAllowedOrigins(d))
	}
	if len(requestData.Allowed) > 0 {
		allowedOrigins = mergeAllowedOrigins(allowedOrigins, requestData.Allowed)
	}

	site := &models.Site{
		SiteID:         siteID,
		Name:           requestData.Name,
		Domain:         normalizedDomain,
		APIKey:         apiKey,
		APISecret:      apiSecret,
		Description:    requestData.Description,
		LogoURL:        requestData.LogoURL,
		AllowedOrigins: allowedOrigins,
		RedirectURI:    buildRedirectURI(normalizedDomain),
		WebhookURL:     strings.TrimSpace(requestData.WebhookURL),
		IsActive:       true,
		OwnerEmail:     requestData.OwnerEmail,
		Plan:           plan,
	}

	siteCRUD := models.NewSiteCRUD()
	if err := siteCRUD.CreateSite(site); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to create site: " + err.Error()}
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

// GetMySites returns sites owned by the current authenticated user.
func (c *SiteController) GetMySites() {
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	ctx := context.Background()
	siteCRUD := models.NewSiteCRUD()
	cur, err := siteCRUD.Collection().Find(ctx, bson.M{"owner_email": user.Email}, &options.FindOptions{Sort: bson.D{{Key: "created_at", Value: -1}}})
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to get sites: " + err.Error()}
		c.ServeJSON()
		return
	}
	defer cur.Close(ctx)

	var sites []models.Site
	if err := cur.All(ctx, &sites); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to decode sites: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"sites": sites}
	c.ServeJSON()
}

// DeleteSite allows site owners or admins to delete a site.
func (c *SiteController) DeleteSite() {
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Authentication required")
		return
	}

	var requestData struct {
		SiteID string `json:"site_id"`
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
	if requestData.SiteID == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "site_id is required")
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(requestData.SiteID)
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "Site not found")
		return
	}

	role := strings.ToLower(strings.TrimSpace(user.Role))
	isOwner := strings.EqualFold(user.UnifiedID, site.OwnerEmail)
	isAdmin := role == "admin"

	if !isOwner && !isAdmin {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Permission denied: only site owners or admins can delete sites")
		return
	}

	if err := siteCRUD.DeleteSite(requestData.SiteID); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to delete site: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Site deleted successfully",
		"site_id": requestData.SiteID,
	}
	c.ServeJSON()
}

// UpdateService allows owners to update allowed_origins and webhook_url of a service.
func (c *SiteController) UpdateService() {
	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var requestData struct {
		SiteID         string   `json:"site_id"`
		AllowedOrigins []string `json:"allowed_origins"`
		WebhookURL     string   `json:"webhook_url"`
		Description    string   `json:"description"`
		LogoURL        string   `json:"logo_url"`
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
	if requestData.SiteID == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "site_id is required")
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(requestData.SiteID)
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "Site not found")
		return
	}

	role := strings.ToLower(strings.TrimSpace(user.Role))
	if !strings.EqualFold(user.Email, site.OwnerEmail) && role != "admin" {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Permission denied")
		return
	}

	if len(requestData.AllowedOrigins) > 0 {
		site.AllowedOrigins = requestData.AllowedOrigins
	}
	if requestData.WebhookURL != "" {
		site.WebhookURL = strings.TrimSpace(requestData.WebhookURL)
	}
	if requestData.Description != "" {
		site.Description = requestData.Description
	}
	if requestData.LogoURL != "" {
		site.LogoURL = requestData.LogoURL
	}

	if err := siteCRUD.UpdateSite(site); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to update site")
		return
	}

	c.Data["json"] = map[string]interface{}{"updated": true, "site_id": site.SiteID}
	c.ServeJSON()
}
func (c *SiteController) GetSiteInfo() {
	site, err := c.authenticateSite()
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized - invalid API key")
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
