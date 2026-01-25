package controllers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"runtime/debug"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/gorilla/sessions"
	"github.com/markbates/goth"
	"github.com/markbates/goth/gothic"
	"github.com/markbates/goth/providers/github"
	"github.com/markbates/goth/providers/google"
	"golang.org/x/crypto/bcrypt"
)

const oauthSessionName = "unified_id_oauth"

func getOAuthCookieSession(r *http.Request) (*sessions.Session, error) {
	if gothic.Store == nil {
		return nil, fmt.Errorf("oauth store not initialized")
	}
	s, err := gothic.Store.Get(r, oauthSessionName)
	if err != nil {
		return nil, err
	}
	return s, nil
}

func saveOAuthCookieSession(w http.ResponseWriter, r *http.Request, s *sessions.Session) error {
	if gothic.Store == nil {
		return fmt.Errorf("oauth store not initialized")
	}
	return s.Save(r, w)
}

func deleteOAuthCookieSession(w http.ResponseWriter, r *http.Request) {
	s, err := getOAuthCookieSession(r)
	if err != nil || s == nil {
		return
	}
	for k := range s.Values {
		delete(s.Values, k)
	}
	s.Options.MaxAge = -1
	_ = s.Save(r, w)
}

func generateSiteTokenForCallback(userID, siteID string) (string, error) {
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
	secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
	if strings.TrimSpace(secret) == "" {
		return "", fmt.Errorf("JWT_SECRET is not configured")
	}
	return token.SignedString([]byte(secret))
}

type AuthController struct {
	web.Controller
}

func (c *AuthController) PasswordRegister() {
	var requestBody struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}

	if err := json.Unmarshal(body, &requestBody); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	requestBody.Email = strings.TrimSpace(strings.ToLower(requestBody.Email))
	requestBody.DisplayName = strings.TrimSpace(requestBody.DisplayName)

	if requestBody.Email == "" || requestBody.Password == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "email and password are required"}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	existing, err := userCRUD.GetUserByEmail(requestBody.Email)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Database error"}
		c.ServeJSON()
		return
	}
	if existing != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusConflict)
		c.Data["json"] = map[string]interface{}{"error": "Email already registered"}
		c.ServeJSON()
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(requestBody.Password), bcrypt.DefaultCost)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to hash password"}
		c.ServeJSON()
		return
	}

	name := requestBody.DisplayName
	if name == "" {
		name = requestBody.Email
	}

	user := &models.User{
		UnifiedID:         generateUnifiedID(),
		Email:             requestBody.Email,
		DisplayName:       name,
		Avatar:            "",
		Role:              "User",
		IsBanned:          false,
		ConnectedServices: []string{},
		OAuthProviders:    []models.OAuthProvider{},
		PasswordHash:      string(hash),
	}

	if err := userCRUD.CreateUser(user); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to create user"}
		c.ServeJSON()
		return
	}

	accessToken, refreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to generate tokens"}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	_ = sessionCRUD.CreateSession(&models.Session{
		Token:     accessToken,
		UserID:    user.UnifiedID,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		IPAddress: c.Ctx.Request.RemoteAddr,
		UserAgent: c.Ctx.Request.UserAgent(),
	})

	c.Data["json"] = map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
		"user": map[string]interface{}{
			"unified_id":   user.UnifiedID,
			"email":        user.Email,
			"display_name": user.DisplayName,
			"role":         user.Role,
		},
	}
	c.ServeJSON()
}

func (c *AuthController) PasswordLogin() {
	var requestBody struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Failed to read request body"}
		c.ServeJSON()
		return
	}

	if err := json.Unmarshal(body, &requestBody); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body"}
		c.ServeJSON()
		return
	}

	if requestBody.Email == "" || requestBody.Password == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "email and password are required"}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByEmail(requestBody.Email)
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Invalid credentials"}
		c.ServeJSON()
		return
	}

	if user.PasswordHash == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Password login is not enabled for this user"}
		c.ServeJSON()
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(requestBody.Password)); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Invalid credentials"}
		c.ServeJSON()
		return
	}

	accessToken, refreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to generate tokens"}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	_ = sessionCRUD.CreateSession(&models.Session{
		Token:     accessToken,
		UserID:    user.UnifiedID,
		ExpiresAt: time.Now().Add(24 * time.Hour),
		IPAddress: c.Ctx.Request.RemoteAddr,
		UserAgent: c.Ctx.Request.UserAgent(),
	})

	c.Data["json"] = map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	c.ServeJSON()
}

// JWT claims structure

// Initialize OAuth providers
func InitOAuthProviders() {
	// Cookie store used by goth/gothic for OAuth state/session
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
		// OAuth callback comes from a third-party (accounts.google.com / github.com), so we need SameSite=None.
		// Modern browsers require Secure=true when SameSite=None, otherwise the cookie is rejected.
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

	// Google OAuth
	googleProvider := google.New(
		firstNonEmpty(os.Getenv("GOOGLE_CLIENT_ID"), web.AppConfig.DefaultString("google_client_id", "")),
		firstNonEmpty(os.Getenv("GOOGLE_CLIENT_SECRET"), web.AppConfig.DefaultString("google_client_secret", "")),
		googleCallback,
		"email", "profile",
	)

	// GitHub OAuth
	githubProvider := github.New(
		firstNonEmpty(os.Getenv("GITHUB_CLIENT_ID"), web.AppConfig.DefaultString("github_client_id", "")),
		firstNonEmpty(os.Getenv("GITHUB_CLIENT_SECRET"), web.AppConfig.DefaultString("github_client_secret", "")),
		githubCallback,
		"user:email",
	)

	// Store providers
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
		c.Data["json"] = map[string]interface{}{
			"error": "Provider is required",
		}
		c.ServeJSON()
		return
	}

	// Validate provider
	validProviders := []string{"google", "github"}
	isValid := false
	for _, p := range validProviders {
		if p == provider {
			isValid = true
			break
		}
	}

	if !isValid {
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid provider",
		}
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

	// Store provider in cookie session for callback
	oauthSess.Values["oauth_provider"] = provider

	// Preserve optional site integration params
	siteID := c.GetString("site_id")
	redirectURL := c.GetString("redirect_url")
	siteState := c.GetString("site_state")
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

	// Generate state parameter for security
	state := generateState()
	oauthSess.Values["oauth_state"] = state
	if err := saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to save oauth session"}
		c.ServeJSON()
		return
	}

	// Ensure goth can detect provider (it expects it in query params)
	q := c.Ctx.Request.URL.Query()
	q.Set("provider", provider)
	// Provide our generated state to goth so it's included exactly once
	q.Set("state", state)
	c.Ctx.Request.URL.RawQuery = q.Encode()

	// Redirect to OAuth provider
	authURL, err := gothic.GetAuthURL(c.Ctx.ResponseWriter, c.Ctx.Request)
	if err != nil {
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to get auth URL: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Redirect to OAuth provider (authURL already contains state)
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
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request context",
		}
		c.ServeJSON()
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
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Provider is required"}
		c.ServeJSON()
		return
	}
	// Ensure goth can detect provider (it expects it in query params)
	q := c.Ctx.Request.URL.Query()
	q.Set("provider", provider)
	c.Ctx.Request.URL.RawQuery = q.Encode()

	storedState, _ := oauthSess.Values["oauth_state"].(string)
	state := c.GetString("state")

	// Verify state parameter
	if storedState == "" || storedState != state {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid state parameter",
		}
		c.ServeJSON()
		return
	}

	// Complete OAuth flow
	user, err := gothic.CompleteUserAuth(c.Ctx.ResponseWriter, c.Ctx.Request)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to complete auth: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Get or create user
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

		// migrate legacy provider into list if needed
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

		accessToken, refreshToken, err := generateTokens(unifiedUser.UnifiedID, unifiedUser.Email)
		if err != nil {
			c.Data["json"] = map[string]interface{}{"error": "Failed to generate tokens: " + err.Error()}
			c.ServeJSON()
			return
		}

		sessionCRUD := models.NewSessionCRUD()
		session := &models.Session{
			Token:     accessToken,
			UserID:    unifiedUser.UnifiedID,
			ExpiresAt: time.Now().Add(24 * time.Hour),
			IPAddress: c.Ctx.Request.RemoteAddr,
			UserAgent: c.Ctx.Request.UserAgent(),
		}
		_ = sessionCRUD.CreateSession(session)

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
		c.Data["json"] = map[string]interface{}{
			"error": "Database error: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	var unifiedUser *models.User
	if existingUser == nil {
		// Try attach to existing account by email (multi-provider)
		byEmail, _ := userCRUD.GetUserByEmail(user.Email)
		if byEmail != nil {
			unifiedUser = byEmail
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
			// Create new user
			unifiedUser = &models.User{
				UnifiedID:         generateUnifiedID(),
				Email:             user.Email,
				DisplayName:       user.Name,
				Avatar:            user.AvatarURL,
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
				c.Data["json"] = map[string]interface{}{
					"error": "Failed to create user: " + err.Error(),
				}
				c.ServeJSON()
				return
			}
		}
	} else {
		// Update existing user
		unifiedUser = existingUser
		unifiedUser.Avatar = user.AvatarURL
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
			c.Data["json"] = map[string]interface{}{
				"error": "Failed to update user: " + err.Error(),
			}
			c.ServeJSON()
			return
		}
	}

	c.DelSession("oauth_state")

	// Generate JWT tokens
	accessToken, refreshToken, err := generateTokens(unifiedUser.UnifiedID, unifiedUser.Email)
	if err != nil {
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to generate tokens: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Create session
	sessionCRUD := models.NewSessionCRUD()
	session := &models.Session{
		Token:     accessToken,
		UserID:    unifiedUser.UnifiedID,
		ExpiresAt: time.Now().Add(24 * time.Hour), // 24 hours
		IPAddress: c.Ctx.Request.RemoteAddr,
		UserAgent: c.Ctx.Request.UserAgent(),
	}

	if err := sessionCRUD.CreateSession(session); err != nil {
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to create session: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	// Return tokens and user info
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

	// If this login was initiated for a site integration, redirect back to the site
	siteID, _ := oauthSess.Values["site_id"].(string)
	redirectURL, _ := oauthSess.Values["redirect_url"].(string)
	siteState, _ := oauthSess.Values["site_state"].(string)

	if siteID != "" && redirectURL != "" {
		deleteOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request)
		// Return standard Neo ID access token (contains unified_id) so the app can call its API
		c.Redirect(redirectURL+"?token="+accessToken+"&state="+siteState, http.StatusTemporaryRedirect)
		return
	}

	_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, oauthSess)
	// Browser flow: redirect back to SPA with tokens
	c.Redirect("/dashboard#access_token="+accessToken+"&refresh_token="+refreshToken, http.StatusTemporaryRedirect)
}

// Logout handles user logout
func (c *AuthController) Logout() {
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}

	if token == "" {
		c.Data["json"] = map[string]interface{}{
			"error": "Token is required",
		}
		c.ServeJSON()
		return
	}

	// Delete session
	sessionCRUD := models.NewSessionCRUD()
	if err := sessionCRUD.DeleteSession(token); err != nil {
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to delete session: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"message": "Logged out successfully",
	}
	c.ServeJSON()
}

// RefreshToken refreshes JWT token
func (c *AuthController) RefreshToken() {
	var requestBody struct {
		RefreshToken string `json:"refresh_token"`
	}

	if err := json.Unmarshal(c.Ctx.Input.RequestBody, &requestBody); err != nil {
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid request body",
		}
		c.ServeJSON()
		return
	}

	// Validate refresh token
	claims := &Claims{}
	token, err := jwt.ParseWithClaims(requestBody.RefreshToken, claims, func(token *jwt.Token) (interface{}, error) {
		secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
		return []byte(secret), nil
	})

	if err != nil || !token.Valid {
		c.Data["json"] = map[string]interface{}{
			"error": "Invalid refresh token",
		}
		c.ServeJSON()
		return
	}

	// Get user
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		c.Data["json"] = map[string]interface{}{
			"error": "User not found",
		}
		c.ServeJSON()
		return
	}

	// Generate new tokens
	accessToken, refreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		c.Data["json"] = map[string]interface{}{
			"error": "Failed to generate tokens: " + err.Error(),
		}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	c.ServeJSON()
}

// Helper functions
func generateState() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func firstNonEmpty(values ...string) string {
	for _, v := range values {
		if strings.TrimSpace(v) != "" {
			return v
		}
	}
	return ""
}

func generateUnifiedID() string {
	return "uid_" + uuid.New().String()
}

func generateTokens(unifiedID, email string) (string, string, error) {
	jwtSecret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
	if jwtSecret == "" {
		jwtSecret = "default-secret-key" // Change in production
	}

	// Access token (24 hours)
	accessClaims := &Claims{
		UnifiedID: unifiedID,
		Email:     email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", "", err
	}

	// Refresh token (30 days)
	refreshClaims := &Claims{
		UnifiedID: unifiedID,
		Email:     email,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
		},
	}

	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(jwtSecret))
	if err != nil {
		return "", "", err
	}

	return accessTokenString, refreshTokenString, nil
}
