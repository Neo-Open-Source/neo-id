package controllers

import (
	"fmt"
	"net/http"
	"net/url"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/sessions"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/github"
	"github.com/markbates/goth/providers/google"
)

// InitOAuthProviders initializes OAuth providers (Google, GitHub)
func InitOAuthProviders() {
	sessionSecret := firstNonEmpty(
		os.Getenv("SESSION_SECRET"),
		os.Getenv("JWT_SECRET"),
		web.AppConfig.DefaultString("jwt_secret", ""),
	)
	if sessionSecret != "" {
		store := sessions.NewCookieStore([]byte(sessionSecret))
		baseURL := strings.ToLower(strings.TrimSpace(os.Getenv("BASE_URL")))
		secure := strings.HasPrefix(baseURL, "https://") || os.Getenv("VERCEL") != "" || os.Getenv("VERCEL_URL") != ""
		sameSite := http.SameSiteLaxMode
		if secure {
			sameSite = http.SameSiteNoneMode
		}
		store.Options = &sessions.Options{
			Path:     "/",
			HttpOnly: true,
			Secure:   secure,
			SameSite: sameSite,
			MaxAge:   86400 * 7,
		}
		gothic.Store = store
	}

	baseUrl := os.Getenv("BASE_URL")
	if baseUrl == "" {
		baseUrl = web.AppConfig.DefaultString("base_url", "http://localhost:8080")
	}
	googleCallback := fmt.Sprintf("%s/api/auth/callback/google", strings.TrimRight(baseUrl, "/"))
	githubCallback := fmt.Sprintf("%s/api/auth/callback/github", strings.TrimRight(baseUrl, "/"))

	googleProvider := google.New(
		firstNonEmpty(os.Getenv("GOOGLE_CLIENT_ID"), web.AppConfig.DefaultString("google_client_id", "")),
		firstNonEmpty(os.Getenv("GOOGLE_CLIENT_SECRET"), web.AppConfig.DefaultString("google_client_secret", "")),
		googleCallback,
		"email", "profile",
	)

	githubProvider := github.New(
		firstNonEmpty(os.Getenv("GITHUB_CLIENT_ID"), web.AppConfig.DefaultString("github_client_id", "")),
		firstNonEmpty(os.Getenv("GITHUB_CLIENT_SECRET"), web.AppConfig.DefaultString("github_client_secret", "")),
		githubCallback,
		"user:email",
	)

	goth.UseProviders(googleProvider, githubProvider)
}

// Login initiates OAuth login
func (c *AuthController) Login() {
	provider := c.GetString("provider")
	if provider == "" {
		provider = c.Ctx.Input.Param(":provider")
	}
	linkMode := c.GetString("link") == "1"
	if provider == "" {
		c.Data["json"] = map[string]interface{}{"error": "Provider is required"}
		c.ServeJSON()
		return
	}

	validProviders := []string{"google", "github"}
	isValid := false
	for _, p := range validProviders {
		if p == provider {
			isValid = true
			break
		}
	}
	if !isValid {
		c.Data["json"] = map[string]interface{}{"error": "Invalid provider"}
		c.ServeJSON()
		return
	}

	oauthSess, err := getOAuthCookieSession(c.Ctx.Request)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to initialize oauth session: " + err.Error()}
		c.ServeJSON()
		return
	}

	oauthSess.Values["oauth_provider"] = provider

	siteID := c.GetString("site_id")
	redirectURL := c.GetString("redirect_url")
	siteState := c.GetString("site_state")
	if siteID != "" && redirectURL != "" {
		siteCRUD := models.NewSiteCRUD()
		site, err := siteCRUD.GetSiteBySiteID(siteID)
		if err != nil || site == nil {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid site_id")
			return
		}
		if err := isAllowedRedirectURL(redirectURL, site); err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "Invalid redirect_url: " + err.Error()}
			c.ServeJSON()
			return
		}
	}
	if siteID != "" {
		oauthSess.Values["site_id"] = siteID
	}
	if redirectURL != "" {
		oauthSess.Values["redirect_url"] = redirectURL
	}
	if siteState != "" {
		oauthSess.Values["site_state"] = siteState
	}

	if linkMode {
		token := c.GetString("token")
		if token == "" {
			c.Data["json"] = map[string]interface{}{"error": "token is required for link mode"}
			c.ServeJSON()
			return
		}

		claims := &Claims{}
		jwtToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
			secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
			return []byte(secret), nil
		})
		if err != nil || !jwtToken.Valid {
			c.Data["json"] = map[string]interface{}{"error": "invalid token"}
			c.ServeJSON()
			return
		}

		sessionCRUD := models.NewSessionCRUD()
		sess, err := sessionCRUD.GetSessionByToken(token)
		if err != nil || sess == nil {
			c.Data["json"] = map[string]interface{}{"error": "session not found"}
			c.ServeJSON()
			return
		}

		oauthSess.Values["oauth_link"] = true
		oauthSess.Values["oauth_link_user"] = claims.UnifiedID
	}

	state := generateState()
	oauthSess.Values["oauth_state"] = state
	if err := saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to save oauth session")
		return
	}

	q := c.Ctx.Request.URL.Query()
	q.Set("provider", provider)
	q.Set("state", state)
	c.Ctx.Request.URL.RawQuery = q.Encode()

	authURL, err := gothic.GetAuthURL(c.Ctx.ResponseWriter, c.Ctx.Request)
	if err != nil {
		c.Data["json"] = map[string]interface{}{"error": "Failed to get auth URL: " + err.Error()}
		c.ServeJSON()
		return
	}

	c.Redirect(authURL, http.StatusTemporaryRedirect)
}

// Callback handles OAuth callback
func (c *AuthController) Callback() {
	defer func() {
		if r := recover(); r != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
			c.Data["json"] = map[string]interface{}{
				"error": fmt.Sprintf("OAuth callback panic: %v", r),
				"stack": string(debug.Stack()),
			}
			c.ServeJSON()
		}
	}()

	if c.Ctx == nil || c.Ctx.Request == nil {
		respondError(&c.Controller, http.StatusInternalServerError, "invalid_request", "Invalid request context")
		return
	}

	provider := c.GetString("provider")
	if provider == "" {
		provider = c.Ctx.Input.Param(":provider")
	}
	oauthSess, err := getOAuthCookieSession(c.Ctx.Request)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to initialize oauth session: " + err.Error()}
		c.ServeJSON()
		return
	}

	if provider == "" {
		if storedProvider, ok := oauthSess.Values["oauth_provider"].(string); ok {
			provider = storedProvider
		}
	}
	if provider == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Provider is required")
		return
	}
	q := c.Ctx.Request.URL.Query()
	q.Set("provider", provider)
	c.Ctx.Request.URL.RawQuery = q.Encode()

	storedState, _ := oauthSess.Values["oauth_state"].(string)
	state := c.GetString("state")

	if storedState == "" || storedState != state {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid state parameter")
		return
	}

	user, err := gothic.CompleteUserAuth(c.Ctx.ResponseWriter, c.Ctx.Request)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to complete auth: " + err.Error()}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	linkMode, _ := oauthSess.Values["oauth_link"].(bool)
	linkUserID, _ := oauthSess.Values["oauth_link_user"].(string)

	if linkMode && linkUserID != "" {
		unifiedUser, err := userCRUD.GetUserByUnifiedID(linkUserID)
		if err != nil || unifiedUser == nil {
			c.Data["json"] = map[string]interface{}{"error": "user not found"}
			c.ServeJSON()
			return
		}
		if strings.TrimSpace(unifiedUser.Role) == "" {
			unifiedUser.Role = "User"
		}

		if len(unifiedUser.OAuthProviders) == 0 && unifiedUser.Provider != "" {
			unifiedUser.OAuthProviders = append(unifiedUser.OAuthProviders, models.OAuthProvider{
				Provider:    unifiedUser.Provider,
				ExternalID:  unifiedUser.ExternalID,
				AccessToken: unifiedUser.AccessToken,
				AddedAt:     time.Now(),
			})
			unifiedUser.Provider = ""
			unifiedUser.ExternalID = ""
			unifiedUser.AccessToken = ""
		}

		already := false
		for _, p := range unifiedUser.OAuthProviders {
			if p.Provider == provider {
				already = true
				break
			}
		}
		if !already {
			unifiedUser.OAuthProviders = append(unifiedUser.OAuthProviders, models.OAuthProvider{
				Provider:    provider,
				ExternalID:  user.UserID,
				AccessToken: user.AccessToken,
				AddedAt:     time.Now(),
			})
		}

		if err := userCRUD.UpdateUser(unifiedUser); err != nil {
			c.Data["json"] = map[string]interface{}{"error": "Failed to link provider: " + err.Error()}
			c.ServeJSON()
			return
		}

		delete(oauthSess.Values, "oauth_link")
		delete(oauthSess.Values, "oauth_link_user")
		delete(oauthSess.Values, "oauth_state")

		months := unifiedUser.RefreshDurationMonths
		if months < 1 || months > 9 {
			months = 1
		}
		accessToken, refreshToken, refreshExp, err := generateTokensWithDuration(unifiedUser.UnifiedID, unifiedUser.Email, months)
		if err != nil {
			c.Data["json"] = map[string]interface{}{"error": "Failed to generate tokens: " + err.Error()}
			c.ServeJSON()
			return
		}

		sessionCRUD := models.NewSessionCRUD()
		session := &models.Session{
			Token:                 accessToken,
			UserID:                unifiedUser.UnifiedID,
			ExpiresAt:             time.Now().Add(24 * time.Hour),
			IPAddress:             getRealIP(c.Ctx.Request),
			UserAgent:             c.Ctx.Request.UserAgent(),
			RefreshToken:          refreshToken,
			RefreshExpiresAt:      refreshExp,
			RefreshDurationMonths: months,
			LastUsedAt:            time.Now(),
		}
		enforceSessionLimit(unifiedUser.UnifiedID)
		_ = sessionCRUD.CreateSession(session)
		createSessionWithGeo(session)

		c.Data["json"] = map[string]interface{}{
			"linked":        true,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
		}
		if c.GetString("format") == "json" {
			c.ServeJSON()
			return
		}

		_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess)
		c.Redirect("/dashboard#access_token="+accessToken+"&refresh_token="+refreshToken+"&linked=1", http.StatusTemporaryRedirect)
		return
	}

	existingUser, err := userCRUD.GetUserByProvider(provider, user.UserID)
	if err != nil {
		c.Data["json"] = map[string]interface{}{"error": "Database error: " + err.Error()}
		c.ServeJSON()
		return
	}

	var unifiedUser *models.User
	if existingUser == nil {
		byEmail, _ := userCRUD.GetUserByEmail(user.Email)
		if byEmail != nil {
			unifiedUser = byEmail
			if strings.TrimSpace(unifiedUser.Role) == "" {
				unifiedUser.Role = "User"
			}
			if len(unifiedUser.OAuthProviders) == 0 && unifiedUser.Provider != "" {
				unifiedUser.OAuthProviders = append(unifiedUser.OAuthProviders, models.OAuthProvider{
					Provider:    unifiedUser.Provider,
					ExternalID:  unifiedUser.ExternalID,
					AccessToken: unifiedUser.AccessToken,
					AddedAt:     time.Now(),
				})
				unifiedUser.Provider = ""
				unifiedUser.ExternalID = ""
				unifiedUser.AccessToken = ""
			}
			unifiedUser.OAuthProviders = append(unifiedUser.OAuthProviders, models.OAuthProvider{
				Provider:    provider,
				ExternalID:  user.UserID,
				AccessToken: user.AccessToken,
				AddedAt:     time.Now(),
			})
			now := time.Now()
			unifiedUser.LastLogin = &now
			_ = userCRUD.UpdateUser(unifiedUser)
		} else {
			unifiedUser = &models.User{
				UnifiedID:         generateUnifiedID(),
				Email:             user.Email,
				DisplayName:       user.Name,
				Avatar:            user.AvatarURL,
				Role:              "User",
				FirstName:         user.FirstName,
				LastName:          user.LastName,
				IsBanned:          false,
				ConnectedServices: []string{},
				OAuthProviders: []models.OAuthProvider{{
					Provider:    provider,
					ExternalID:  user.UserID,
					AccessToken: user.AccessToken,
					AddedAt:     time.Now(),
				}},
			}
			if err := userCRUD.CreateUser(unifiedUser); err != nil {
				c.Data["json"] = map[string]interface{}{"error": "Failed to create user: " + err.Error()}
				c.ServeJSON()
				return
			}
		}
	} else {
		unifiedUser = existingUser
		if strings.TrimSpace(unifiedUser.Role) == "" {
			unifiedUser.Role = "User"
		}
		if strings.TrimSpace(unifiedUser.Avatar) == "" {
			unifiedUser.Avatar = user.AvatarURL
		}
		unifiedUser.DisplayName = user.Name
		now := time.Now()
		unifiedUser.LastLogin = &now

		if len(unifiedUser.OAuthProviders) == 0 && unifiedUser.Provider != "" {
			unifiedUser.OAuthProviders = append(unifiedUser.OAuthProviders, models.OAuthProvider{
				Provider:    unifiedUser.Provider,
				ExternalID:  unifiedUser.ExternalID,
				AccessToken: unifiedUser.AccessToken,
				AddedAt:     time.Now(),
			})
			unifiedUser.Provider = ""
			unifiedUser.ExternalID = ""
			unifiedUser.AccessToken = ""
		}

		seen := false
		for _, p := range unifiedUser.OAuthProviders {
			if p.Provider == provider {
				seen = true
				break
			}
		}
		if !seen {
			unifiedUser.OAuthProviders = append(unifiedUser.OAuthProviders, models.OAuthProvider{
				Provider:    provider,
				ExternalID:  user.UserID,
				AccessToken: user.AccessToken,
				AddedAt:     time.Now(),
			})
		}

		if err := userCRUD.UpdateUser(unifiedUser); err != nil {
			c.Data["json"] = map[string]interface{}{"error": "Failed to update user: " + err.Error()}
			c.ServeJSON()
			return
		}
	}

	oauthMonths := unifiedUser.RefreshDurationMonths
	if oauthMonths < 1 || oauthMonths > 9 {
		oauthMonths = 1
	}

	// MFA check — require verification before issuing session
	if unifiedUser.TOTPEnabled || unifiedUser.EmailMFAEnabled {
		if unifiedUser.EmailMFAEnabled {
			mfaCode, err := generateEmailVerificationCode()
			if err == nil {
				mfaCRUD := models.NewMFACodeCRUD()
				_ = mfaCRUD.DeleteByEmail(unifiedUser.Email)
				exp := time.Now().Add(10 * time.Minute)
				_ = mfaCRUD.Create(&models.MFACode{
					UserID:    unifiedUser.UnifiedID,
					Email:     unifiedUser.Email,
					Code:      mfaCode,
					ExpiresAt: exp,
				})
				_ = sendResendEmail(unifiedUser.Email, "Your login code", buildMFACodeHTML(mfaCode))
			}
		}

		verifyType := "mfa"
		if unifiedUser.TOTPEnabled && !unifiedUser.EmailMFAEnabled {
			verifyType = "totp"
		}

		siteID, _ := oauthSess.Values["site_id"].(string)
		redirectURL, _ := oauthSess.Values["redirect_url"].(string)
		siteState, _ := oauthSess.Values["site_state"].(string)

		// Store pending MFA context in cookie session
		oauthSess.Values["mfa_pending_uid"] = unifiedUser.UnifiedID
		oauthSess.Values["mfa_pending_months"] = oauthMonths
		oauthSess.Values["mfa_pending_site_id"] = siteID
		oauthSess.Values["mfa_pending_redirect_url"] = redirectURL
		oauthSess.Values["mfa_pending_site_state"] = siteState
		_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess)

		oidcClientID, _ := oauthSess.Values["oidc_client_id"].(string)
		oidcRedirectURI, _ := oauthSess.Values["oidc_redirect_uri"].(string)
		oidcScope, _ := oauthSess.Values["oidc_scope"].(string)
		oidcState, _ := oauthSess.Values["oidc_state"].(string)
		oidcMode, _ := oauthSess.Values["oidc_mode"].(string)

		// Pass MFA + optional OIDC context to frontend via hash so VerifyPage can continue to consent.
		q := url.Values{}
		q.Set("mfa_email", unifiedUser.Email)
		q.Set("mfa_verify_type", verifyType)
		if oidcClientID != "" && oidcRedirectURI != "" {
			q.Set("mfa_oidc", "1")
			q.Set("mfa_client_id", oidcClientID)
			q.Set("mfa_redirect_uri", oidcRedirectURI)
			if oidcState != "" {
				q.Set("mfa_state", oidcState)
			}
			if oidcScope != "" {
				q.Set("mfa_scope", oidcScope)
			}
			if oidcMode != "" {
				q.Set("mfa_mode", oidcMode)
			}
		}
		c.Redirect("/verify#"+q.Encode(), http.StatusFound)
		return
	}
	accessToken, refreshToken, refreshExp, err := generateTokensWithDuration(unifiedUser.UnifiedID, unifiedUser.Email, oauthMonths)
	if err != nil {
		c.Data["json"] = map[string]interface{}{"error": "Failed to generate tokens: " + err.Error()}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	session := &models.Session{
		Token:                 accessToken,
		UserID:                unifiedUser.UnifiedID,
		ExpiresAt:             time.Now().Add(24 * time.Hour),
		IPAddress:             getRealIP(c.Ctx.Request),
		UserAgent:             c.Ctx.Request.UserAgent(),
		RefreshToken:          refreshToken,
		RefreshExpiresAt:      refreshExp,
		RefreshDurationMonths: oauthMonths,
		LastUsedAt:            time.Now(),
	}
	enforceSessionLimit(unifiedUser.UnifiedID)
	if err := sessionCRUD.CreateSession(session); err != nil {
		c.Data["json"] = map[string]interface{}{"error": "Failed to create session: " + err.Error()}
		c.ServeJSON()
		return
	}
	createSessionWithGeo(session)

	if c.GetString("format") == "json" {
		c.Data["json"] = map[string]interface{}{
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"user": map[string]interface{}{
				"unified_id":   unifiedUser.UnifiedID,
				"email":        unifiedUser.Email,
				"display_name": unifiedUser.DisplayName,
				"avatar":       unifiedUser.Avatar,
			},
		}
		c.ServeJSON()
		return
	}

	// OIDC authorization flow should always continue to consent, not dashboard/site callback.
	oidcClientID, _ := oauthSess.Values["oidc_client_id"].(string)
	oidcRedirectURI, _ := oauthSess.Values["oidc_redirect_uri"].(string)
	oidcScope, _ := oauthSess.Values["oidc_scope"].(string)
	oidcState, _ := oauthSess.Values["oidc_state"].(string)
	oidcNonce, _ := oauthSess.Values["oidc_nonce"].(string)
	oidcCodeChallenge, _ := oauthSess.Values["oidc_code_challenge"].(string)
	oidcCodeChallengeMethod, _ := oauthSess.Values["oidc_code_challenge_method"].(string)
	oidcMode, _ := oauthSess.Values["oidc_mode"].(string)
	if oidcClientID != "" && oidcRedirectURI != "" {
		key := newConsentSession(&pendingConsent{
			ClientID:            oidcClientID,
			RedirectURI:         oidcRedirectURI,
			Scope:               oidcScope,
			State:               oidcState,
			Nonce:               oidcNonce,
			CodeChallenge:       oidcCodeChallenge,
			CodeChallengeMethod: oidcCodeChallengeMethod,
			Mode:                oidcMode,
			UserID:              unifiedUser.UnifiedID,
			ExpiresAt:           time.Now().Add(10 * time.Minute),
		})

		delete(oauthSess.Values, "oidc_client_id")
		delete(oauthSess.Values, "oidc_redirect_uri")
		delete(oauthSess.Values, "oidc_scope")
		delete(oauthSess.Values, "oidc_state")
		delete(oauthSess.Values, "oidc_nonce")
		delete(oauthSess.Values, "oidc_code_challenge")
		delete(oauthSess.Values, "oidc_code_challenge_method")
		delete(oauthSess.Values, "oidc_mode")
		_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess)

		c.Redirect("/consent?session="+key, http.StatusFound)
		return
	}

	siteID, _ := oauthSess.Values["site_id"].(string)
	redirectURL, _ := oauthSess.Values["redirect_url"].(string)
	siteState, _ := oauthSess.Values["site_state"].(string)

	if siteID != "" && redirectURL != "" {
		siteCRUD := models.NewSiteCRUD()
		site, err := siteCRUD.GetSiteBySiteID(siteID)
		if err != nil || site == nil {
			respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid site_id")
			return
		}
		if err := isAllowedRedirectURL(redirectURL, site); err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "Invalid redirect_url: " + err.Error()}
			c.ServeJSON()
			return
		}

		siteToken, err := generateSiteTokenForCallback(unifiedUser.UnifiedID, siteID)
		if err != nil {
			respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate site token")
			return
		}

		deleteOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request)
		redirectURLWithToken, err := withTokenAndState(redirectURL, siteToken, "", siteState)
		if err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
			c.Data["json"] = map[string]interface{}{"error": "Invalid redirect_url: " + err.Error()}
			c.ServeJSON()
			return
		}
		c.Redirect(redirectURLWithToken, http.StatusTemporaryRedirect)
		return
	}

	_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess)
	c.Redirect("/dashboard#access_token="+accessToken+"&refresh_token="+refreshToken, http.StatusTemporaryRedirect)
}
