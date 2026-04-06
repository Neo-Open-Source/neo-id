package controllers

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"unified-id/models"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// VerifyEmail verifies email via token link
func (c *AuthController) VerifyEmail() {
	token := strings.TrimSpace(c.GetString("token"))
	if token == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "token is required")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByEmailVerificationToken(token)
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusBadRequest, "unauthorized", "invalid token")
		return
	}

	if user.EmailVerificationExpiresAt != nil && time.Now().After(*user.EmailVerificationExpiresAt) {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "token expired")
		return
	}

	user.EmailVerified = true
	user.EmailVerificationToken = ""
	user.EmailVerificationExpiresAt = nil
	user.EmailVerificationCode = ""
	user.EmailVerificationCodeExpAt = nil
	if err := userCRUD.UpdateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to verify email")
		return
	}

	if c.GetString("format") == "json" {
		c.Data["json"] = map[string]interface{}{"verified": true}
		c.ServeJSON()
		return
	}

	c.Redirect("/login?verified=1", http.StatusTemporaryRedirect)
}

// VerifyEmailCode verifies email via 6-digit code and auto-logs in
func (c *AuthController) VerifyEmailCode() {
	var requestBody struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestBody); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	emailAddr := strings.TrimSpace(strings.ToLower(requestBody.Email))
	code := strings.TrimSpace(requestBody.Code)
	if emailAddr == "" || code == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "email and code are required")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByEmail(emailAddr)
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "user not found")
		return
	}
	if user.EmailVerified {
		c.Data["json"] = map[string]interface{}{"verified": true}
		c.ServeJSON()
		return
	}

	if user.EmailVerificationCode == "" || user.EmailVerificationCodeExpAt == nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "verification code is not available")
		return
	}
	if time.Now().After(*user.EmailVerificationCodeExpAt) {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "code expired")
		return
	}
	if code != user.EmailVerificationCode {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid code")
		return
	}

	user.EmailVerified = true
	user.EmailVerificationToken = ""
	user.EmailVerificationExpiresAt = nil
	user.EmailVerificationCode = ""
	user.EmailVerificationCodeExpAt = nil
	if err := userCRUD.UpdateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to verify email")
		return
	}

	// Auto-login after verification
	accessToken, refreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		c.Data["json"] = map[string]interface{}{"verified": true}
		c.ServeJSON()
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	verifySess := makeSession(accessToken, user.UnifiedID, getRealIP(c.Ctx.Request), c.Ctx.Request.UserAgent(), user.RefreshDurationMonths, refreshToken, time.Now().AddDate(0, max(user.RefreshDurationMonths, 1), 0))
	enforceSessionLimit(user.UnifiedID)
	_ = sessionCRUD.CreateSession(verifySess)
	createSessionWithGeo(verifySess)

	c.Data["json"] = map[string]interface{}{
		"verified":      true,
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	c.ServeJSON()
}

// ResendVerifyEmail resends the email verification code
func (c *AuthController) ResendVerifyEmail() {
	var requestBody struct {
		Email string `json:"email"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestBody); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	email := strings.TrimSpace(strings.ToLower(requestBody.Email))
	if email == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "email is required")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByEmail(email)
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusNotFound, "not_found", "user not found")
		return
	}
	if user.EmailVerified {
		c.Data["json"] = map[string]interface{}{"sent": false, "message": "already verified"}
		c.ServeJSON()
		return
	}

	verifyToken := uuid.NewString()
	expiresAt := time.Now().Add(24 * time.Hour)
	code, codeErr := generateEmailVerificationCode()
	codeExp := time.Now().Add(30 * time.Minute)
	if codeErr != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate verification code")
		return
	}
	user.EmailVerificationToken = verifyToken
	user.EmailVerificationExpiresAt = &expiresAt
	user.EmailVerificationCode = code
	user.EmailVerificationCodeExpAt = &codeExp
	if err := userCRUD.UpdateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to update verification token")
		return
	}

	verifyURL := getBaseURL() + "/api/auth/verify-email?token=" + verifyToken
	htmlBody := buildEmailVerificationHTML(code, verifyURL)
	if err := sendResendEmail(email, "Verify your email", htmlBody); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"sent": true}
	c.ServeJSON()
}

// PasswordRegister registers a new user with email/password
func (c *AuthController) PasswordRegister() {
	var requestBody struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		DisplayName string `json:"display_name"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestBody); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid request body: " + err.Error()}
		c.ServeJSON()
		return
	}

	requestBody.Email = strings.TrimSpace(strings.ToLower(requestBody.Email))
	requestBody.DisplayName = strings.TrimSpace(requestBody.DisplayName)

	if requestBody.Email == "" || requestBody.Password == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "email and password are required")
		return
	}

	userCRUD := models.NewUserCRUD()
	existing, err := userCRUD.GetUserByEmail(requestBody.Email)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Database error")
		return
	}
	if existing != nil {
		respondError(&c.Controller, http.StatusConflict, "conflict", "Email already registered")
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(requestBody.Password), bcrypt.DefaultCost)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to hash password")
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
		EmailVerified:     false,
	}

	verifyToken := uuid.NewString()
	expiresAt := time.Now().Add(24 * time.Hour)
	code, codeErr := generateEmailVerificationCode()
	codeExp := time.Now().Add(30 * time.Minute)
	if codeErr != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate verification code")
		return
	}
	user.EmailVerificationToken = verifyToken
	user.EmailVerificationExpiresAt = &expiresAt
	user.EmailVerificationCode = code
	user.EmailVerificationCodeExpAt = &codeExp

	if err := userCRUD.CreateUser(user); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to create user")
		return
	}

	verifyURL := getBaseURL() + "/api/auth/verify-email?token=" + verifyToken
	htmlBody := buildEmailVerificationHTML(code, verifyURL)
	if err := sendResendEmail(user.Email, "Verify your email", htmlBody); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": err.Error()}
		c.ServeJSON()
		return
	}

	c.Data["json"] = map[string]interface{}{"verification_sent": true}
	c.ServeJSON()
}

// PasswordLogin authenticates a user with email/password
func (c *AuthController) PasswordLogin() {
	var requestBody struct {
		Email       string `json:"email"`
		Password    string `json:"password"`
		SiteID      string `json:"site_id"`
		RedirectURL string `json:"redirect_url"`
		SiteState   string `json:"site_state"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestBody); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	if requestBody.Email == "" || requestBody.Password == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "email and password are required")
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByEmail(requestBody.Email)
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "invalid_credentials", "Invalid credentials")
		return
	}

	if user.PasswordHash == "" {
		respondError(&c.Controller, http.StatusUnauthorized, "invalid_request", "Password login is not enabled for this user")
		return
	}
	if !user.EmailVerified {
		respondError(&c.Controller, http.StatusForbidden, "invalid_request", "Email is not verified")
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(requestBody.Password)); err != nil {
		respondError(&c.Controller, http.StatusUnauthorized, "invalid_credentials", "Invalid credentials")
		return
	}

	if user.TOTPEnabled {
		c.Data["json"] = map[string]interface{}{
			"totp_required": true,
			"email":         user.Email,
		}
		c.ServeJSON()
		return
	}

	if user.EmailMFAEnabled {
		mfaCode, err := generateEmailVerificationCode()
		if err != nil {
			respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate login code")
			return
		}
		mfaCRUD := models.NewMFACodeCRUD()
		_ = mfaCRUD.DeleteByEmail(user.Email)
		exp := time.Now().Add(10 * time.Minute)
		_ = mfaCRUD.Create(&models.MFACode{
			UserID:      user.UnifiedID,
			Email:       user.Email,
			Code:        mfaCode,
			ExpiresAt:   exp,
			SiteID:      requestBody.SiteID,
			RedirectURL: requestBody.RedirectURL,
			SiteState:   requestBody.SiteState,
		})
		htmlBody := buildMFACodeHTML(mfaCode)
		if err := sendResendEmail(user.Email, "Your login code", htmlBody); err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
			c.Data["json"] = map[string]interface{}{"error": err.Error()}
			c.ServeJSON()
			return
		}
		c.Data["json"] = map[string]interface{}{
			"mfa_required": true,
			"email":        user.Email,
		}
		c.ServeJSON()
		return
	}

	months := user.RefreshDurationMonths
	if months < 1 || months > 9 {
		months = 1
	}
	accessToken, refreshToken, refreshExp, err := generateTokensWithDuration(user.UnifiedID, user.Email, months)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate tokens")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	newSess := &models.Session{
		Token:                 accessToken,
		UserID:                user.UnifiedID,
		ExpiresAt:             time.Now().Add(24 * time.Hour),
		IPAddress:             getRealIP(c.Ctx.Request),
		UserAgent:             c.Ctx.Request.UserAgent(),
		RefreshToken:          refreshToken,
		RefreshExpiresAt:      refreshExp,
		RefreshDurationMonths: months,
		LastUsedAt:            time.Now(),
	}
	enforceSessionLimit(user.UnifiedID)
	_ = sessionCRUD.CreateSession(newSess)
	createSessionWithGeo(newSess)
	setAuthCookie(c.Ctx.ResponseWriter, accessToken)

	resp := map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	if requestBody.SiteID != "" {
		resp["site_id"] = requestBody.SiteID
		resp["redirect_url"] = requestBody.RedirectURL
		resp["site_state"] = requestBody.SiteState
	}
	c.Data["json"] = resp
	c.ServeJSON()
}

// MFAVerify verifies the login code sent to email and issues tokens
func (c *AuthController) MFAVerify() {
	var requestBody struct {
		Email string `json:"email"`
		Code  string `json:"code"`
	}

	body, err := io.ReadAll(c.Ctx.Request.Body)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "server_error", "Failed to read request body")
		return
	}
	if err := json.Unmarshal(body, &requestBody); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid request body")
		return
	}

	email := strings.TrimSpace(strings.ToLower(requestBody.Email))
	code := strings.TrimSpace(requestBody.Code)
	if email == "" || code == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "email and code are required")
		return
	}

	mfaCRUD := models.NewMFACodeCRUD()
	pending, err := mfaCRUD.GetByEmail(email)
	if err != nil || pending == nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "No pending login code. Please sign in again.")
		return
	}

	if pending.Code != code {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "Invalid code")
		return
	}

	_ = mfaCRUD.MarkUsed(pending.ID)

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(pending.UserID)
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusInternalServerError, "not_found", "User not found")
		return
	}

	if user.IsBanned {
		respondError(&c.Controller, http.StatusForbidden, "access_denied", "Account is banned")
		return
	}

	accessToken, refreshToken, err := generateTokens(user.UnifiedID, user.Email)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate tokens")
		return
	}

	sessionCRUD := models.NewSessionCRUD()
	mfaSess := makeSession(accessToken, user.UnifiedID, getRealIP(c.Ctx.Request), c.Ctx.Request.UserAgent(), user.RefreshDurationMonths, refreshToken, time.Now().AddDate(0, max(user.RefreshDurationMonths, 1), 0))
	enforceSessionLimit(user.UnifiedID)
	_ = sessionCRUD.CreateSession(mfaSess)
	createSessionWithGeo(mfaSess)

	resp := map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	if pending.SiteID != "" {
		resp["site_id"] = pending.SiteID
		resp["redirect_url"] = pending.RedirectURL
		resp["site_state"] = pending.SiteState
	}

	c.Data["json"] = resp
	c.ServeJSON()
}
