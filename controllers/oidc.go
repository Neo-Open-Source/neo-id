package controllers

// OpenID Connect (OIDC) implementation for Neo ID
//
// Endpoints:
//   GET  /.well-known/openid-configuration  — discovery document
//   GET  /.well-known/jwks.json             — public keys
//   GET  /oauth/authorize                   — authorization endpoint (redirects to login)
//   POST /oauth/token                       — token endpoint (code → tokens)
//   GET  /oauth/userinfo                    — userinfo endpoint (Bearer access_token)
//   POST /oauth/revoke                      — token revocation
//
// Flow:
//   1. Client redirects user to /oauth/authorize?client_id=<site_id>&redirect_uri=...&scope=openid...&state=...&response_type=code
//   2. User logs in via Neo ID (existing login page)
//   3. Neo ID redirects to redirect_uri?code=<auth_code>&state=...
//   4. Client POSTs to /oauth/token with code + client_id + client_secret (api_secret)
//   5. Neo ID returns access_token, id_token (JWT), refresh_token
//   6. Client calls /oauth/userinfo with Bearer access_token

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
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
)

// OIDCController handles OpenID Connect endpoints
type OIDCController struct {
	web.Controller
}

// ─── Discovery ───────────────────────────────────────────────────────────────

// Discovery returns the OpenID Connect discovery document
func (c *OIDCController) Discovery() {
	base := getBaseURL()
	c.Data["json"] = map[string]interface{}{
		"issuer":                                base,
		"authorization_endpoint":                base + "/oauth/authorize",
		"token_endpoint":                        base + "/oauth/token",
		"userinfo_endpoint":                     base + "/oauth/userinfo",
		"jwks_uri":                              base + "/.well-known/jwks.json",
		"revocation_endpoint":                   base + "/oauth/revoke",
		"end_session_endpoint":                  base + "/oauth/logout",
		"response_types_supported":              []string{"code"},
		"subject_types_supported":               []string{"public"},
		"id_token_signing_alg_values_supported": []string{"HS256"},
		"scopes_supported":                      []string{"openid", "profile", "email"},
		"token_endpoint_auth_methods_supported": []string{"client_secret_post", "client_secret_basic"},
		"claims_supported":                      []string{"sub", "iss", "aud", "exp", "iat", "email", "email_verified", "name", "picture", "given_name", "family_name"},
		"grant_types_supported":                 []string{"authorization_code", "refresh_token"},
		"code_challenge_methods_supported":      []string{"S256", "plain"},
	}
	c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Origin", "*")
	c.ServeJSON()
}

// JWKS returns the JSON Web Key Set (symmetric key info for HS256)
func (c *OIDCController) JWKS() {
	// For HS256 we don't expose the secret key — clients verify via /oauth/userinfo or /oauth/token introspection.
	// We still return a valid JWKS structure indicating the algorithm.
	c.Data["json"] = map[string]interface{}{
		"keys": []map[string]interface{}{
			{
				"kty": "oct",
				"use": "sig",
				"alg": "HS256",
				"kid": "neo-id-hs256",
			},
		},
	}
	c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Origin", "*")
	c.ServeJSON()
}

// ─── Authorization ────────────────────────────────────────────────────────────

// Authorize handles the OIDC authorization endpoint.
// It validates the request and redirects the user to the login page.
func (c *OIDCController) Authorize() {
	clientID := strings.TrimSpace(c.GetString("client_id"))
	redirectURI := strings.TrimSpace(c.GetString("redirect_uri"))
	responseType := strings.TrimSpace(c.GetString("response_type"))
	scope := strings.TrimSpace(c.GetString("scope"))
	state := strings.TrimSpace(c.GetString("state"))
	nonce := strings.TrimSpace(c.GetString("nonce"))
	codeChallenge := strings.TrimSpace(c.GetString("code_challenge"))
	codeChallengeMethod := strings.TrimSpace(c.GetString("code_challenge_method"))

	// Validate required params
	if clientID == "" || redirectURI == "" {
		c.oidcError("invalid_request", "client_id and redirect_uri are required", redirectURI, state)
		return
	}
	if responseType != "code" {
		c.oidcError("unsupported_response_type", "only 'code' response_type is supported", redirectURI, state)
		return
	}
	if !strings.Contains(scope, "openid") {
		c.oidcError("invalid_scope", "scope must include 'openid'", redirectURI, state)
		return
	}

	// Validate client (site)
	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(clientID)
	if err != nil || site == nil || !site.IsActive {
		c.oidcError("invalid_client", "unknown client_id", redirectURI, state)
		return
	}

	// Validate redirect_uri
	if err := isAllowedRedirectURL(redirectURI, site); err != nil {
		c.oidcError("invalid_request", "redirect_uri not allowed: "+err.Error(), "", state)
		return
	}

	// Store OIDC params in session so login page can pick them up
	sess, _ := getOAuthCookieSession(c.Ctx.Request)
	sess.Values["oidc_client_id"] = clientID
	sess.Values["oidc_redirect_uri"] = redirectURI
	sess.Values["oidc_scope"] = scope
	sess.Values["oidc_state"] = state
	sess.Values["oidc_nonce"] = nonce
	sess.Values["oidc_code_challenge"] = codeChallenge
	sess.Values["oidc_code_challenge_method"] = codeChallengeMethod
	_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, sess)

	// Redirect to login with OIDC context
	q := url.Values{}
	q.Set("oidc", "1")
	q.Set("client_id", clientID)
	if state != "" {
		q.Set("state", state)
	}
	c.Redirect("/login?"+q.Encode(), http.StatusFound)
}

// ─── Token ────────────────────────────────────────────────────────────────────

// Token handles the OIDC token endpoint (authorization_code and refresh_token grants)
func (c *OIDCController) Token() {
	c.Ctx.ResponseWriter.Header().Set("Cache-Control", "no-store")
	c.Ctx.ResponseWriter.Header().Set("Pragma", "no-cache")
	c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Origin", "*")

	if c.Ctx.Request.Method == http.MethodOptions {
		c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Methods", "POST, OPTIONS")
		c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNoContent)
		return
	}

	grantType := strings.TrimSpace(c.GetString("grant_type"))
	if grantType == "" {
		// Try reading from body
		body, _ := io.ReadAll(c.Ctx.Request.Body)
		vals, _ := url.ParseQuery(string(body))
		grantType = strings.TrimSpace(vals.Get("grant_type"))
		if grantType == "" {
			c.tokenError("invalid_request", "grant_type is required")
			return
		}
		// Re-parse all params from body
		c.handleTokenFromValues(vals)
		return
	}

	switch grantType {
	case "authorization_code":
		c.handleAuthCodeGrant()
	case "refresh_token":
		c.handleRefreshTokenGrant()
	default:
		c.tokenError("unsupported_grant_type", "supported: authorization_code, refresh_token")
	}
}

func (c *OIDCController) handleTokenFromValues(vals url.Values) {
	grantType := vals.Get("grant_type")
	switch grantType {
	case "authorization_code":
		code := vals.Get("code")
		clientID := vals.Get("client_id")
		clientSecret := vals.Get("client_secret")
		redirectURI := vals.Get("redirect_uri")
		codeVerifier := vals.Get("code_verifier")
		c.processAuthCodeGrant(code, clientID, clientSecret, redirectURI, codeVerifier)
	case "refresh_token":
		refreshToken := vals.Get("refresh_token")
		clientID := vals.Get("client_id")
		clientSecret := vals.Get("client_secret")
		c.processRefreshTokenGrant(refreshToken, clientID, clientSecret)
	default:
		c.tokenError("unsupported_grant_type", "supported: authorization_code, refresh_token")
	}
}

func (c *OIDCController) handleAuthCodeGrant() {
	code := strings.TrimSpace(c.GetString("code"))
	clientID := strings.TrimSpace(c.GetString("client_id"))
	clientSecret := strings.TrimSpace(c.GetString("client_secret"))
	redirectURI := strings.TrimSpace(c.GetString("redirect_uri"))
	codeVerifier := strings.TrimSpace(c.GetString("code_verifier"))

	// Try Basic auth
	if clientID == "" || clientSecret == "" {
		if u, p, ok := c.Ctx.Request.BasicAuth(); ok {
			clientID = u
			clientSecret = p
		}
	}

	c.processAuthCodeGrant(code, clientID, clientSecret, redirectURI, codeVerifier)
}

func (c *OIDCController) processAuthCodeGrant(code, clientID, clientSecret, redirectURI, codeVerifier string) {
	if code == "" || clientID == "" {
		c.tokenError("invalid_request", "code and client_id are required")
		return
	}

	// Validate client
	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteBySiteID(clientID)
	if err != nil || site == nil || !site.IsActive {
		c.tokenError("invalid_client", "unknown client_id")
		return
	}

	// Validate client_secret (unless PKCE is used)
	authCodeCRUD := models.NewAuthCodeCRUD()
	authCode, err := authCodeCRUD.GetByCode(code)
	if err != nil || authCode == nil {
		c.tokenError("invalid_grant", "invalid or expired authorization code")
		return
	}

	if authCode.ClientID != clientID {
		c.tokenError("invalid_grant", "code was not issued to this client")
		return
	}
	if authCode.Used {
		c.tokenError("invalid_grant", "authorization code already used")
		return
	}
	if time.Now().After(authCode.ExpiresAt) {
		c.tokenError("invalid_grant", "authorization code expired")
		return
	}
	if redirectURI != "" && authCode.RedirectURI != redirectURI {
		c.tokenError("invalid_grant", "redirect_uri mismatch")
		return
	}

	// PKCE verification
	if authCode.CodeChallenge != "" {
		if codeVerifier == "" {
			c.tokenError("invalid_grant", "code_verifier required")
			return
		}
		if !verifyCodeChallenge(codeVerifier, authCode.CodeChallenge, authCode.CodeChallengeMethod) {
			c.tokenError("invalid_grant", "code_verifier mismatch")
			return
		}
	} else if clientSecret == "" {
		c.tokenError("invalid_client", "client_secret required")
		return
	} else if clientSecret != site.APISecret {
		c.tokenError("invalid_client", "invalid client_secret")
		return
	}

	// Mark code as used
	_ = authCodeCRUD.MarkUsed(authCode.ID)

	// Get user
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(authCode.UserID)
	if err != nil || user == nil {
		c.tokenError("server_error", "user not found")
		return
	}

	// Generate tokens
	accessToken, refreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		c.tokenError("server_error", "failed to generate tokens")
		return
	}

	// Generate ID token (OIDC)
	idToken, err := generateIDToken(user, site, authCode.Nonce)
	if err != nil {
		c.tokenError("server_error", "failed to generate id_token")
		return
	}

	// Store session
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
		"token_type":    "Bearer",
		"expires_in":    86400,
		"refresh_token": refreshToken,
		"id_token":      idToken,
		"scope":         authCode.Scope,
	}
	c.ServeJSON()
}

func (c *OIDCController) handleRefreshTokenGrant() {
	refreshToken := strings.TrimSpace(c.GetString("refresh_token"))
	clientID := strings.TrimSpace(c.GetString("client_id"))
	clientSecret := strings.TrimSpace(c.GetString("client_secret"))
	if clientID == "" || clientSecret == "" {
		if u, p, ok := c.Ctx.Request.BasicAuth(); ok {
			clientID = u
			clientSecret = p
		}
	}
	c.processRefreshTokenGrant(refreshToken, clientID, clientSecret)
}

func (c *OIDCController) processRefreshTokenGrant(refreshToken, clientID, clientSecret string) {
	if refreshToken == "" {
		c.tokenError("invalid_request", "refresh_token is required")
		return
	}

	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(refreshToken, claims, func(t *jwt.Token) (interface{}, error) {
		secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
		return []byte(secret), nil
	})
	if err != nil || !tok.Valid {
		c.tokenError("invalid_grant", "invalid refresh_token")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		c.tokenError("invalid_grant", "user not found")
		return
	}

	accessToken, newRefreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		c.tokenError("server_error", "failed to generate tokens")
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
		"token_type":    "Bearer",
		"expires_in":    86400,
		"refresh_token": newRefreshToken,
	}
	c.ServeJSON()
}

// ─── UserInfo ─────────────────────────────────────────────────────────────────

// UserInfo returns claims about the authenticated user
func (c *OIDCController) UserInfo() {
	c.Ctx.ResponseWriter.Header().Set("Access-Control-Allow-Origin", "*")

	token := strings.TrimPrefix(c.Ctx.Request.Header.Get("Authorization"), "Bearer ")
	token = strings.TrimSpace(token)
	if token == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Ctx.ResponseWriter.Header().Set("WWW-Authenticate", `Bearer realm="neo-id"`)
		c.Data["json"] = map[string]interface{}{"error": "unauthorized"}
		c.ServeJSON()
		return
	}

	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
		return []byte(secret), nil
	})
	if err != nil || !tok.Valid {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "invalid_token"}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	sess, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || sess == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "invalid_token"}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil || user.IsBanned {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "invalid_token"}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{
		"sub":            user.UnifiedID,
		"email":          user.Email,
		"email_verified": user.EmailVerified,
		"name":           user.DisplayName,
		"given_name":     user.FirstName,
		"family_name":    user.LastName,
		"picture":        user.Avatar,
		"updated_at":     user.UpdatedAt.Unix(),
	}
	c.ServeJSON()
}

// ─── Revoke ───────────────────────────────────────────────────────────────────

// Revoke handles token revocation (RFC 7009)
func (c *OIDCController) Revoke() {
	token := strings.TrimSpace(c.GetString("token"))
	if token == "" {
		body, _ := io.ReadAll(c.Ctx.Request.Body)
		vals, _ := url.ParseQuery(string(body))
		token = strings.TrimSpace(vals.Get("token"))
	}
	if token != "" {
		sessionCRUD := models.NewSessionCRUD()
		_ = sessionCRUD.DeleteSession(token)
	}
	// Always return 200 per RFC 7009
	c.Ctx.ResponseWriter.WriteHeader(http.StatusOK)
}

// ─── OIDC Callback (after login) ─────────────────────────────────────────────

// OIDCCallback is called after the user successfully logs in via the standard login page.
// It generates an authorization code and redirects back to the client.
func (c *OIDCController) OIDCCallback() {
	// Get OIDC params from session
	sess, err := getOAuthCookieSession(c.Ctx.Request)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "session error"}
		c.ServeJSON()
		return
	}

	clientID, _ := sess.Values["oidc_client_id"].(string)
	redirectURI, _ := sess.Values["oidc_redirect_uri"].(string)
	scope, _ := sess.Values["oidc_scope"].(string)
	state, _ := sess.Values["oidc_state"].(string)
	nonce, _ := sess.Values["oidc_nonce"].(string)
	codeChallenge, _ := sess.Values["oidc_code_challenge"].(string)
	codeChallengeMethod, _ := sess.Values["oidc_code_challenge_method"].(string)

	if clientID == "" || redirectURI == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "no pending OIDC request"}
		c.ServeJSON()
		return
	}

	// Get authenticated user from token
	token := strings.TrimPrefix(c.Ctx.Request.Header.Get("Authorization"), "Bearer ")
	token = strings.TrimSpace(token)
	if token == "" {
		token = strings.TrimSpace(c.GetString("token"))
	}
	if token == "" {
		c.Redirect("/login?oidc=1&client_id="+clientID, http.StatusFound)
		return
	}

	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
		return []byte(secret), nil
	})
	if err != nil || !tok.Valid {
		c.Redirect("/login?oidc=1&client_id="+clientID, http.StatusFound)
		return
	}

	// Generate authorization code
	code := generateAuthCode()
	authCodeCRUD := models.NewAuthCodeCRUD()
	_ = authCodeCRUD.Create(&models.AuthCode{
		Code:                code,
		ClientID:            clientID,
		UserID:              claims.UnifiedID,
		RedirectURI:         redirectURI,
		Scope:               scope,
		Nonce:               nonce,
		CodeChallenge:       codeChallenge,
		CodeChallengeMethod: codeChallengeMethod,
		ExpiresAt:           time.Now().Add(10 * time.Minute),
	})

	// Clear OIDC session params
	delete(sess.Values, "oidc_client_id")
	delete(sess.Values, "oidc_redirect_uri")
	delete(sess.Values, "oidc_scope")
	delete(sess.Values, "oidc_state")
	delete(sess.Values, "oidc_nonce")
	delete(sess.Values, "oidc_code_challenge")
	delete(sess.Values, "oidc_code_challenge_method")
	_ = saveOAuthCookieSession(c.Ctx.ResponseWriter, c.Ctx.Request, sess)

	// Redirect to client with code
	q := url.Values{}
	q.Set("code", code)
	if state != "" {
		q.Set("state", state)
	}
	c.Redirect(redirectURI+"?"+q.Encode(), http.StatusFound)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

func (c *OIDCController) oidcError(errCode, description, redirectURI, state string) {
	if redirectURI != "" {
		q := url.Values{}
		q.Set("error", errCode)
		q.Set("error_description", description)
		if state != "" {
			q.Set("state", state)
		}
		c.Redirect(redirectURI+"?"+q.Encode(), http.StatusFound)
		return
	}
	c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
	c.Data["json"] = map[string]interface{}{"error": errCode, "error_description": description}
	c.ServeJSON()
}

func (c *OIDCController) tokenError(errCode, description string) {
	c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
	c.Data["json"] = map[string]interface{}{"error": errCode, "error_description": description}
	c.ServeJSON()
}

func generateAuthCode() string {
	b := make([]byte, 32)
	rand.Read(b)
	return base64.URLEncoding.EncodeToString(b)
}

func generateIDToken(user *models.User, site *models.Site, nonce string) (string, error) {
	secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
	if secret == "" {
		return "", fmt.Errorf("JWT_SECRET not configured")
	}

	now := time.Now()
	claims := jwt.MapClaims{
		"iss":            getBaseURL(),
		"sub":            user.UnifiedID,
		"aud":            site.SiteID,
		"exp":            now.Add(time.Hour).Unix(),
		"iat":            now.Unix(),
		"auth_time":      now.Unix(),
		"email":          user.Email,
		"email_verified": user.EmailVerified,
		"name":           user.DisplayName,
		"given_name":     user.FirstName,
		"family_name":    user.LastName,
		"picture":        user.Avatar,
	}
	if nonce != "" {
		claims["nonce"] = nonce
	}

	tok := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	tok.Header["kid"] = "neo-id-hs256"
	return tok.SignedString([]byte(secret))
}

func verifyCodeChallenge(verifier, challenge, method string) bool {
	switch strings.ToUpper(method) {
	case "S256":
		h := sha256.Sum256([]byte(verifier))
		computed := base64.RawURLEncoding.EncodeToString(h[:])
		return computed == challenge
	case "PLAIN", "":
		return verifier == challenge
	default:
		return false
	}
}

// keep unused imports satisfied
var _ = fmt.Sprintf
