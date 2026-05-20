package controllers

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"io"
	"net/http"
	"strings"
	"time"

	"unified-id/models"

	"go.mongodb.org/mongo-driver/bson/primitive"
)

// ListPasskeys returns all passkeys for the authenticated user.
func (c *UserController) ListPasskeys() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	passkeys, err := models.NewPasskeyCRUD().ListByUserID(user.UnifiedID)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to load passkeys")
		return
	}

	if passkeys == nil {
		passkeys = []*models.Passkey{}
	}

	c.Data["json"] = map[string]interface{}{"passkeys": passkeys}
	c.ServeJSON()
}

// BeginPasskeyRegistration creates WebAuthn creation options.
func (c *UserController) BeginPasskeyRegistration() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		MFACode string `json:"mfa_code"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	mfaVerified := false
	if user.TOTPEnabled || user.EmailMFAEnabled {
		code := strings.TrimSpace(body.MFACode)
		if code == "" {
			respondError(&c.Controller, http.StatusBadRequest, "mfa_required", "verification code is required")
			return
		}
		// If authenticator app is enabled, it is mandatory for passkey enrollment.
		if user.TOTPEnabled {
			if !verifyTOTPCode(code, user.TOTPSecret) {
				respondError(&c.Controller, http.StatusBadRequest, "invalid_code", "Invalid authenticator code")
				return
			}
			mfaVerified = true
		} else if user.EmailMFAEnabled {
			if !verifyEmailMFACodeExpiry(user.Email, code) {
				respondError(&c.Controller, http.StatusBadRequest, "invalid_code", "Invalid verification code")
				return
			}
			mfaVerified = true
		}
	} else {
		mfaVerified = true
	}

	challenge := make([]byte, 32)
	if _, err := rand.Read(challenge); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to generate challenge")
		return
	}
	challengeB64 := base64.RawURLEncoding.EncodeToString(challenge)

	// Keep challenge in DB for verify step.
	_ = models.NewPasskeyChallengeCRUD().DeleteByUserID(user.UnifiedID)
	_ = models.NewPasskeyChallengeCRUD().Create(&models.PasskeyChallenge{
		UserID:      user.UnifiedID,
		Challenge:   challengeB64,
		Type:        "registration",
		MFAVerified: mfaVerified,
		ExpiresAt:   time.Now().Add(10 * time.Minute),
		CreatedAt:   time.Now(),
	})

	passkeys, _ := models.NewPasskeyCRUD().ListByUserID(user.UnifiedID)
	exclude := make([]map[string]interface{}, 0, len(passkeys))
	for _, p := range passkeys {
		exclude = append(exclude, map[string]interface{}{
			"type": "public-key",
			"id":   p.CredentialID,
		})
	}

	displayName := strings.TrimSpace(strings.TrimSpace(user.FirstName + " " + user.LastName))
	if displayName == "" {
		displayName = user.DisplayName
	}
	if displayName == "" {
		displayName = user.Email
	}

	host := c.Ctx.Request.Host
	rpID := host
	if idx := strings.IndexByte(host, ':'); idx >= 0 {
		rpID = host[:idx]
	}

	c.Data["json"] = map[string]interface{}{
		"publicKey": map[string]interface{}{
			"challenge": challengeB64,
			"rp": map[string]interface{}{
				"name": "Neo ID",
				"id":   rpID,
			},
			"user": map[string]interface{}{
				"id":          base64.RawURLEncoding.EncodeToString([]byte(user.UnifiedID)),
				"name":        user.Email,
				"displayName": displayName,
			},
			"pubKeyCredParams": []map[string]interface{}{
				{"type": "public-key", "alg": -7},   // ES256
				{"type": "public-key", "alg": -257}, // RS256
			},
			"authenticatorSelection": map[string]interface{}{
				"residentKey":      "preferred",
				"userVerification": "preferred",
			},
			"timeout":            60000,
			"attestation":        "none",
			"excludeCredentials": exclude,
		},
	}
	c.ServeJSON()
}

// FinishPasskeyRegistration verifies challenge and stores passkey metadata.
func (c *UserController) FinishPasskeyRegistration() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		Name  string `json:"name"`
		ID    string `json:"id"`
		RawID string `json:"rawId"`
		Type  string `json:"type"`
		Resp  struct {
			ClientDataJSON    string   `json:"clientDataJSON"`
			AttestationObject string   `json:"attestationObject"`
			Transports        []string `json:"transports"`
		} `json:"response"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	if strings.TrimSpace(body.ID) == "" || strings.TrimSpace(body.RawID) == "" || strings.TrimSpace(body.Resp.ClientDataJSON) == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid passkey payload")
		return
	}

	chal, err := models.NewPasskeyChallengeCRUD().GetByUserID(user.UnifiedID)
	if err != nil || chal == nil || time.Now().After(chal.ExpiresAt) {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "passkey challenge expired")
		return
	}
	if !chal.MFAVerified {
		respondError(&c.Controller, http.StatusBadRequest, "mfa_required", "verification code is required")
		return
	}

	clientDataBytes, err := base64.RawURLEncoding.DecodeString(body.Resp.ClientDataJSON)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid clientDataJSON")
		return
	}
	var clientData struct {
		Type      string `json:"type"`
		Challenge string `json:"challenge"`
		Origin    string `json:"origin"`
	}
	if err := json.Unmarshal(clientDataBytes, &clientData); err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid clientDataJSON format")
		return
	}
	if clientData.Type != "webauthn.create" || clientData.Challenge != chal.Challenge {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "challenge mismatch")
		return
	}

	name := strings.TrimSpace(body.Name)
	if name == "" {
		name = "Passkey"
	}
	passkey := &models.Passkey{
		UserID:       user.UnifiedID,
		Name:         name,
		CredentialID: body.RawID,
		PublicKey:    body.Resp.AttestationObject,
		Transports:   body.Resp.Transports,
		DeviceType:   "platform",
	}
	if err := models.NewPasskeyCRUD().Create(passkey); err != nil {
		respondError(&c.Controller, http.StatusConflict, "conflict", "Passkey already exists")
		return
	}
	_ = models.NewPasskeyChallengeCRUD().DeleteByUserID(user.UnifiedID)

	c.Data["json"] = map[string]interface{}{"passkey": passkey}
	c.ServeJSON()
}

// CreatePasskey stores passkey metadata for the authenticated user.
func (c *UserController) CreatePasskey() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		Name         string   `json:"name"`
		CredentialID string   `json:"credential_id"`
		PublicKey    string   `json:"public_key"`
		Transports   []string `json:"transports"`
		DeviceType   string   `json:"device_type"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)

	name := strings.TrimSpace(body.Name)
	credentialID := strings.TrimSpace(body.CredentialID)
	if name == "" || credentialID == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "name and credential_id are required")
		return
	}

	passkey := &models.Passkey{
		UserID:       user.UnifiedID,
		Name:         name,
		CredentialID: credentialID,
		PublicKey:    strings.TrimSpace(body.PublicKey),
		Transports:   body.Transports,
		DeviceType:   strings.TrimSpace(body.DeviceType),
	}
	if err := models.NewPasskeyCRUD().Create(passkey); err != nil {
		respondError(&c.Controller, http.StatusConflict, "conflict", "Passkey already exists")
		return
	}

	c.Data["json"] = map[string]interface{}{"passkey": passkey}
	c.ServeJSON()
}

// DeletePasskey removes one passkey for the authenticated user.
func (c *UserController) DeletePasskey() {
	user, err := c.authenticateUser()
	if err != nil || user == nil {
		respondError(&c.Controller, http.StatusUnauthorized, "unauthorized", "Unauthorized")
		return
	}

	var body struct {
		ID string `json:"id"`
	}
	raw, _ := io.ReadAll(c.Ctx.Request.Body)
	_ = json.Unmarshal(raw, &body)
	if strings.TrimSpace(body.ID) == "" {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "id is required")
		return
	}
	oid, err := primitive.ObjectIDFromHex(body.ID)
	if err != nil {
		respondError(&c.Controller, http.StatusBadRequest, "invalid_request", "invalid id")
		return
	}

	if err := models.NewPasskeyCRUD().DeleteByIDForUser(oid, user.UnifiedID); err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to delete passkey")
		return
	}
	c.Data["json"] = map[string]interface{}{"deleted": true}
	c.ServeJSON()
}
