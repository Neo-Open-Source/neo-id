package controllers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"time"

	"unified-id/models"

	"go.mongodb.org/mongo-driver/bson"
)

// GetConnectedServices returns the user's connected and available services.
func (c *UserController) GetConnectedServices() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	serviceCRUD := models.NewServiceCRUD()
	allServices, err := serviceCRUD.GetAllActiveServices()
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to get services: " + err.Error()}
		c.ServeJSON()
		return
	}

	siteCRUD := models.NewSiteCRUD()
	allSites, _ := siteCRUD.GetAllActiveSites()

	connectedSet := map[string]bool{}
	for _, s := range user.ConnectedServices {
		connectedSet[s] = true
	}

	var connectedServices []map[string]interface{}
	var availableServices []map[string]interface{}

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

// ConnectService connects a service to the user's account.
func (c *UserController) ConnectService() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var requestData struct {
		ServiceName string `json:"service_name"`
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

	serviceCRUD := models.NewServiceCRUD()
	service, err := serviceCRUD.GetServiceByName(requestData.ServiceName)
	if err != nil || service == nil || !service.IsActive {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "Service not found or inactive")
		return
	}

	for _, connectedService := range user.ConnectedServices {
		if connectedService == requestData.ServiceName {
			c.Data["json"] = map[string]interface{}{"error": "Service already connected"}
			c.ServeJSON()
			return
		}
	}

	userCRUD := models.NewUserCRUD()
	if err := userCRUD.AddConnectedService(user.UnifiedID, requestData.ServiceName); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to connect service: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Service connected successfully",
		"service": requestData.ServiceName,
	}
	c.ServeJSON()
}

// DisconnectService disconnects a service from the user's account.
func (c *UserController) DisconnectService() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var requestData struct {
		ServiceName string `json:"service_name"`
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

	isConnected := false
	for _, connectedService := range user.ConnectedServices {
		if connectedService == requestData.ServiceName {
			isConnected = true
			break
		}
	}
	if !isConnected {
		c.Data["json"] = map[string]interface{}{"error": "Service not connected"}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	if err := userCRUD.RemoveConnectedService(user.UnifiedID, requestData.ServiceName); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to disconnect service: " + err.Error()}
		c.ServeJSON()
		return
	}

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

	go notifyServiceDisconnect(requestData.ServiceName, user.UnifiedID, user.Email)

	c.Data["json"] = map[string]interface{}{
		"message": "Service disconnected successfully",
		"service": requestData.ServiceName,
	}
	c.ServeJSON()
}

// notifyServiceDisconnect calls the service's webhook when a user disconnects it.
func notifyServiceDisconnect(serviceName, unifiedID, email string) {
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
		payload, _ := json.Marshal(map[string]interface{}{
			"event":      "user.disconnected",
			"unified_id": unifiedID,
			"email":      email,
			"service":    serviceName,
		})
		client := &http.Client{Timeout: 10 * time.Second}
		for _, webhookURL := range webhookCandidates(site) {
			req, err := http.NewRequest(http.MethodPost, webhookURL, bytes.NewReader(payload))
			if err != nil {
				continue
			}
			req.Header.Set("Content-Type", "application/json")
			req.Header.Set("X-Neo-ID-Event", "user.disconnected")
			resp, err := client.Do(req)
			if err == nil {
				resp.Body.Close()
				if resp.StatusCode >= 200 && resp.StatusCode < 300 {
					break
				}
			}
		}
	}
}

func webhookCandidates(site models.Site) []string {
	seen := map[string]struct{}{}
	out := []string{}
	add := func(v string) {
		v = strings.TrimSpace(v)
		if v == "" {
			return
		}
		if _, ok := seen[v]; ok {
			return
		}
		seen[v] = struct{}{}
		out = append(out, v)
	}

	add(site.WebhookURL)

	domain := strings.TrimSpace(site.Domain)
	if domain == "" {
		return out
	}
	raw := domain
	if !strings.HasPrefix(strings.ToLower(raw), "http://") && !strings.HasPrefix(strings.ToLower(raw), "https://") {
		raw = "https://" + raw
	}
	u, err := url.Parse(raw)
	if err != nil || strings.TrimSpace(u.Host) == "" {
		return out
	}

	basePath := "/api/v1/webhooks/neo-id"
	hostWithPort := u.Host
	scheme := u.Scheme
	if scheme == "" {
		scheme = "https"
	}
	add(fmt.Sprintf("%s://%s%s", scheme, hostWithPort, basePath))

	host := strings.ToLower(strings.TrimSpace(u.Hostname()))
	if host != "" && strings.Contains(host, ".") && host != "localhost" {
		root := strings.TrimPrefix(host, "www.")
		if !strings.HasPrefix(root, "api.") {
			port := ""
			if p := u.Port(); p != "" {
				port = ":" + p
			}
			add(fmt.Sprintf("%s://api.%s%s%s", scheme, root, port, basePath))
		}
	}

	return out
}
