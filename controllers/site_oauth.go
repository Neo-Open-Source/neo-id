package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"net/url"
	"strings"

	"unified-id/models"
)

// SiteLogin handles login requests from integrated sites.
func (c *SiteController) SiteLogin() {
	origin := c.Ctx.Request.Header.Get("Origin")
	if origin != "" {
		c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Origin", origin)
		c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")
		c.Ctx.ResponseWriter.Header().Set("Vary", "Origin")
	}
	if c.Ctx.Request.Method == "OPTIONS" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNoContent)
		return
	}

	site, err := c.authenticateSite()
	if err != nil || site == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		apiKey := strings.TrimSpace(c.Ctx.Request.Header.Get("X-API-Key"))
		if apiKey == "" {
			auth := c.Ctx.Request.Header.Get("Authorization")
			apiKey = strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		}
		prefix := apiKey
		if len(prefix) > 10 {
			prefix = prefix[:10] + "..."
		}
		c.Data["json"] = map[string]interface{}{
			"error":      "Unauthorized - invalid API key",
			"key_prefix": prefix,
		}
		c.ServeJSON()
		return
	}

	var requestData struct {
		RedirectURL string `json:"redirect_url"`
		State       string `json:"state"`
		Mode        string `json:"mode"`
	}
	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}
	if err := json.Unmarshal(body, &requestData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if err := isAllowedRedirectURL(requestData.RedirectURL, site); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid redirect_url: " + err.Error()}
		c.ServeJSON()
		return
	}

	loginURL := "/oauth/authorize?" +
		"client_id=" + site.SiteID +
		"&redirect_uri=" + url.QueryEscape(requestData.RedirectURL) +
		"&response_type=code" +
		"&scope=openid+profile+email" +
		"&state=" + url.QueryEscape(requestData.State)
	if requestData.Mode == "popup" {
		loginURL += "&mode=popup"
	}

	c.Data["json"] = map[string]interface{}{
		"login_url": loginURL,
		"site_id":   site.SiteID,
	}
	c.ServeJSON()
}

// SiteCallback handles OAuth callback for integrated sites.
func (c *SiteController) SiteCallback() {
	siteID := c.GetString("site_id")
	redirectURL := c.GetString("redirect_url")
	state := c.GetString("state")

	if siteID == "" || redirectURL == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "site_id and redirect_url are required")
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(siteID)
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "Site not found")
		return
	}

	if err := isAllowedRedirectURL(redirectURL, site); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid redirect_url: " + err.Error()}
		c.ServeJSON()
		return
	}

	user, err := c.getAuthenticatedUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "User not authenticated")
		return
	}

	connectionCRUD := models.NewUserSiteConnectionCRUD()
	if err := connectionCRUD.ConnectUserToSite(user.UnifiedID, siteID, site.Name); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to connect user to site: " + err.Error()}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	_ = userCRUD.AddConnectedService(user.UnifiedID, site.Name)

	accessToken := strings.TrimSpace(c.GetString("token"))
	refreshToken := strings.TrimSpace(c.GetString("refresh_token"))
	if accessToken == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "token is required")
		return
	}

	redirectURLWithToken, err := withTokenAndState(redirectURL, accessToken, refreshToken, state)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid redirect_url: " + err.Error()}
		c.ServeJSON()
		return
	}

	mode := c.GetString("mode")
	if mode == "popup" {
		origin := strings.TrimRight(redirectURL, "/")
		if u, err := url.Parse(redirectURL); err == nil {
			origin = u.Scheme + "://" + u.Host
		}
		html := `<!doctype html><html><head><meta charset="utf-8"></head><body><script>
(function(){
  var data={type:"neo_id_auth",access_token:"` + accessToken + `",refresh_token:"` + refreshToken + `",state:"` + state + `"};
  if(window.opener){window.opener.postMessage(data,"` + origin + `");window.close();}
  else{window.location.replace("` + redirectURLWithToken + `");}
})();
</script></body></html>`
		c.Ctx.ResponseWriter.Header().Set("Content-Type", "text/html; charset=utf-8")
		c.Ctx.ResponseWriter.Write([]byte(html))
		return
	}

	c.Redirect(redirectURLWithToken, http.StatusTemporaryRedirect)
}

// VerifySiteToken verifies a site-specific token.
func (c *SiteController) VerifySiteToken() {
	site, err := c.authenticateSite()
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized - invalid API key")
		return
	}

	var requestData struct {
		Token string `json:"token"`
	}
	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &requestData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	userID, tokenSiteID, err := c.verifySiteToken(requestData.Token)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Invalid token: " + err.Error()}
		c.ServeJSON()
		return
	}

	if tokenSiteID != site.SiteID {
		respondError(&c.Controller, http.StatusForbidden, "forbidden", "Token is not valid for this site")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(userID)
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "User not found")
		return
	}

	connectionCRUD := models.NewUserSiteConnectionCRUD()
	connectionCRUD.UpdateLastAccess(userID, site.SiteID)

	c.Data["json"] = map[string]interface{}{
		"valid": true,
		"user": map[string]interface{}{
			"unified_id":   user.UnifiedID,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"avatar":       publicAvatarURL(user.Avatar),
			"first_name":   user.FirstName,
			"last_name":    user.LastName,
		},
	}
	c.ServeJSON()
}

// UserDeleted handles notification from a site that a user deleted their account there.
func (c *SiteController) UserDeleted() {
	site, err := c.authenticateSite()
	if err != nil || site == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		UnifiedID string `json:"unified_id"`
		Email     string `json:"email"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	userCRUD := models.NewUserCRUD()
	var user *models.User

	if body.UnifiedID != "" {
		user, _ = userCRUD.GetUserByUnifiedID(body.UnifiedID)
	}
	if user == nil && body.Email != "" {
		user, _ = userCRUD.GetUserByEmail(body.Email)
	}

	if user != nil {
		_ = userCRUD.RemoveConnectedService(user.UnifiedID, site.Name)
		connCRUD := models.NewUserSiteConnectionCRUD()
		_ = connCRUD.DisconnectUserFromSite(user.UnifiedID, site.SiteID)
	}

	c.Data["json"] = map[string]interface{}{"ok": true}
	c.ServeJSON()
}
