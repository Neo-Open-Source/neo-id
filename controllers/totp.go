package controllers

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"image/png"
	"io"
	"net/http"
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"github.com/pquerna/otp/totp"
)

type TOTPController struct {
	web.Controller
}

func (c *TOTPController) authenticateUser() (*models.User, error) {
	token := strings.TrimPrefix(c.Ctx.Request.Header.Get("Authorization"), "Bearer ")
	token = strings.TrimSpace(token)
	if token == "" {
		return nil, nil
	}
	claims := &Claims{}
	tok, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
		secret := firstNonEmpty(os.Getenv("JWT_SECRET"), web.AppConfig.DefaultString("jwt_secret", ""))
		return []byte(secret), nil
	})
	if err != nil || !tok.Valid {
		return nil, nil
	}
	sessionCRUD := models.NewSessionCRUD()
	sess, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || sess == nil {
		return nil, nil
	}
	userCRUD := models.NewUserCRUD()
	return userCRUD.GetUserByUnifiedID(claims.UnifiedID)
}

// Setup generates a new TOTP secret and returns QR code + manual key
func (c *TOTPController) Setup() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	issuer := "Neo ID"
	key, err := totp.Generate(totp.GenerateOpts{
		Issuer:      issuer,
		AccountName: user.Email,
	})
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to generate TOTP secret"}
		c.ServeJSON()
		return
	}

	// Generate QR code PNG → base64
	img, err := key.Image(200, 200)
	if err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to generate QR code"}
		c.ServeJSON()
		return
	}
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
		c.Data["json"] = map[string]interface{}{"error": "Failed to encode QR code"}
		c.ServeJSON()
		return
	}
	qrBase64 := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())

	// Store secret temporarily (not enabled yet — user must verify first)
	user.TOTPSecret = key.Secret()
	user.TOTPEnabled = false
	_ = models.NewUserCRUD().UpdateUser(user)

	c.Data["json"] = map[string]interface{}{
		"secret":  key.Secret(),
		"qr_code": qrBase64,
		"otpauth": key.URL(),
		"issuer":  issuer,
		"account": user.Email,
	}
	c.ServeJSON()
}

// Verify confirms the first TOTP code and enables TOTP for the account
func (c *TOTPController) Verify() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	var body struct {
		Code string `json:"code"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if strings.TrimSpace(body.Code) == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "code is required"}
		c.ServeJSON()
		return
	}
	if user.TOTPSecret == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "TOTP not set up. Call /setup first."}
		c.ServeJSON()
		return
	}

	valid := totp.Validate(strings.TrimSpace(body.Code), user.TOTPSecret)
	if !valid {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid code"}
		c.ServeJSON()
		return
	}

	user.TOTPEnabled = true
	_ = models.NewUserCRUD().UpdateUser(user)

	c.Data["json"] = map[string]interface{}{"enabled": true}
	c.ServeJSON()
}

// Disable turns off TOTP (requires valid TOTP code as confirmation)
func (c *TOTPController) Disable() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		c.Data["json"] = map[string]interface{}{"error": "Unauthorized"}
		c.ServeJSON()
		return
	}

	var body struct {
		Code string `json:"code"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if !user.TOTPEnabled {
		c.Data["json"] = map[string]interface{}{"disabled": true}
		c.ServeJSON()
		return
	}

	if !totp.Validate(strings.TrimSpace(body.Code), user.TOTPSecret) {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid code"}
		c.ServeJSON()
		return
	}

	user.TOTPEnabled = false
	user.TOTPSecret = ""
	_ = models.NewUserCRUD().UpdateUser(user)

	c.Data["json"] = map[string]interface{}{"disabled": true}
	c.ServeJSON()
}

// LoginVerify is called during login when TOTP is enabled
// It receives email + TOTP code (no password — password was already verified)
func (c *TOTPController) LoginVerify() {
	var body struct {
		Email string `json:"email"`
		Code  string `json:"code"`
		// Optional site context
		SiteID      string `json:"site_id"`
		RedirectURL string `json:"redirect_url"`
		SiteState   string `json:"site_state"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	email := strings.TrimSpace(strings.ToLower(body.Email))
	code := strings.TrimSpace(body.Code)
	if email == "" || code == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "email and code are required"}
		c.ServeJSON()
		return
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByEmail(email)
	if err != nil || user == nil || !user.TOTPEnabled {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "TOTP not enabled for this account"}
		c.ServeJSON()
		return
	}

	if !totp.Validate(code, user.TOTPSecret) {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		c.Data["json"] = map[string]interface{}{"error": "Invalid code"}
		c.ServeJSON()
		return
	}

	if user.IsBanned {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusForbidden)
		c.Data["json"] = map[string]interface{}{"error": "Account is banned"}
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
		IPAddress: getRealIP(c.Ctx.Request),
		UserAgent: c.Ctx.Request.UserAgent(),
	})

	resp := map[string]interface{}{
		"access_token":  accessToken,
		"refresh_token": refreshToken,
	}
	if body.SiteID != "" {
		resp["site_id"] = body.SiteID
		resp["redirect_url"] = body.RedirectURL
		resp["site_state"] = body.SiteState
	}
	c.Data["json"] = resp
	c.ServeJSON()
}

// totpValidateCode is exported within the package for use by other controllers
func totpValidateCode(code, secret string) bool {
	return totp.Validate(strings.TrimSpace(code), secret)
}
