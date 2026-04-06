package controllers

// OIDCConsent handles the consent page flow.
//
// GET  /api/oauth/consent-info?session=<token>  — returns site info + user info for the consent UI
// POST /api/oauth/consent                       — user approved, issues auth code and redirects

import (
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"unified-id/models"
)

// pendingConsent holds OIDC params while the user is on the consent page.
type pendingConsent struct {
	ClientID            string
	RedirectURI         string
	Scope               string
	State               string
	Nonce               string
	CodeChallenge       string
	CodeChallengeMethod string
	Mode                string
	UserID              string
	ExpiresAt           time.Time
}

var (
	consentMu    sync.Mutex
	consentStore = map[string]*pendingConsent{}
)

func newConsentSession(pc *pendingConsent) string {
	b := make([]byte, 24)
	rand.Read(b)
	key := base64.RawURLEncoding.EncodeToString(b)
	consentMu.Lock()
	consentStore[key] = pc
	consentMu.Unlock()
	return key
}

func getConsentSession(key string) *pendingConsent {
	consentMu.Lock()
	defer consentMu.Unlock()
	pc := consentStore[key]
	if pc == nil || time.Now().After(pc.ExpiresAt) {
		delete(consentStore, key)
		return nil
	}
	return pc
}

func deleteConsentSession(key string) {
	consentMu.Lock()
	delete(consentStore, key)
	consentMu.Unlock()
}

// ConsentInfo returns site + user info for the consent page (called by frontend).
// GET /api/oauth/consent-info?session=<key>
func (c *OIDCController) ConsentInfo() {
	key := strings.TrimSpace(c.GetString("session"))
	if key == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"error": "session required"})
		return
	}
	pc := getConsentSession(key)
	if pc == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"error": "session expired or not found"})
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, _ := siteCRUD.GetSiteBySiteID(pc.ClientID)

	userCRUD := models.NewUserCRUD()
	user, _ := userCRUD.GetUserByUnifiedID(pc.UserID)

	siteName := pc.ClientID
	siteLogo := ""
	siteDesc := ""
	if site != nil {
		siteName = site.Name
		siteLogo = site.LogoURL
		siteDesc = site.Description
	}

	userName := ""
	userEmail := ""
	userAvatar := ""
	if user != nil {
		userName = user.DisplayName
		userEmail = user.Email
		userAvatar = user.Avatar
	}

	c.Ctx.ResponseWriter.Header().Set("Content-Type", "application/json")
	json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]interface{}{
		"site": map[string]string{
			"id":          pc.ClientID,
			"name":        siteName,
			"logo":        siteLogo,
			"description": siteDesc,
		},
		"user": map[string]string{
			"name":   userName,
			"email":  userEmail,
			"avatar": userAvatar,
		},
		"scope": pc.Scope,
		"mode":  pc.Mode,
	})
}

// Consent handles the user's approval on the consent page.
// POST /api/oauth/consent  body: {"session":"<key>","approved":true}
func (c *OIDCController) Consent() {
	c.Ctx.ResponseWriter.Header().Set("Content-Type", "application/json")

	var body struct {
		Session  string `json:"session"`
		Approved bool   `json:"approved"`
	}
	if err := json.NewDecoder(c.Ctx.Request.Body).Decode(&body); err != nil || body.Session == "" {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"error": "invalid request"})
		return
	}

	pc := getConsentSession(body.Session)
	if pc == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusGone)
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"error": "session expired"})
		return
	}

	if !body.Approved {
		deleteConsentSession(body.Session)
		q := url.Values{}
		q.Set("error", "access_denied")
		if pc.State != "" {
			q.Set("state", pc.State)
		}
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{
			"redirect": pc.RedirectURI + "?" + q.Encode(),
		})
		return
	}

	// Issue auth code
	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(pc.UserID)
	if err != nil || user == nil {
		c.Ctx.ResponseWriter.WriteHeader(http.StatusUnauthorized)
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"error": "user not found"})
		return
	}

	siteCRUD := models.NewSiteCRUD()
	site, _ := siteCRUD.GetSiteBySiteID(pc.ClientID)

	code := generateAuthCode()
	authCodeCRUD := models.NewAuthCodeCRUD()
	_ = authCodeCRUD.Create(&models.AuthCode{
		Code:                code,
		ClientID:            pc.ClientID,
		UserID:              user.UnifiedID,
		RedirectURI:         pc.RedirectURI,
		Scope:               pc.Scope,
		Nonce:               pc.Nonce,
		CodeChallenge:       pc.CodeChallenge,
		CodeChallengeMethod: pc.CodeChallengeMethod,
		ExpiresAt:           time.Now().Add(10 * time.Minute),
	})

	// Connect user to site
	if site != nil {
		_ = models.NewUserCRUD().AddConnectedService(user.UnifiedID, site.Name)
		_ = models.NewUserSiteConnectionCRUD().ConnectUserToSite(user.UnifiedID, pc.ClientID, site.Name)
	}

	deleteConsentSession(body.Session)

	q := url.Values{}
	q.Set("code", code)
	if pc.State != "" {
		q.Set("state", pc.State)
	}
	finalURL := pc.RedirectURI + "?" + q.Encode()

	// Popup mode: return tokens for postMessage
	if pc.Mode == "popup" {
		// Reuse existing browser session token if it belongs to the same user.
		bearer := strings.TrimSpace(strings.TrimPrefix(c.Ctx.Request.Header.Get("Authorization"), "Bearer "))
		if bearer != "" {
			sessionCRUD := models.NewSessionCRUD()
			if existing, err2 := sessionCRUD.GetSessionByToken(bearer); err2 == nil && existing != nil && existing.UserID == pc.UserID {
				origin := pc.RedirectURI
				if u, err3 := url.Parse(pc.RedirectURI); err3 == nil {
					origin = u.Scheme + "://" + u.Host
				}
				json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]interface{}{
					"popup":         true,
					"access_token":  bearer,
					"refresh_token": existing.RefreshToken,
					"state":         pc.State,
					"origin":        origin,
					"redirect":      finalURL,
				})
				return
			}
		}

		// Fallback: issue a fresh session if no reusable session token was provided.
		months := user.RefreshDurationMonths
		if months < 1 {
			months = 1
		}
		accessToken, refreshToken, refreshExp, err := generateTokensWithDuration(user.UnifiedID, user.Email, months)
		if err != nil {
			c.Ctx.ResponseWriter.WriteHeader(http.StatusInternalServerError)
			json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"error": "failed to generate session tokens"})
			return
		}
		sessionCRUD := models.NewSessionCRUD()
		sess := makeSession(accessToken, user.UnifiedID, "", "", months, refreshToken, refreshExp)
		enforceSessionLimit(user.UnifiedID)
		_ = sessionCRUD.CreateSession(sess)

		origin := pc.RedirectURI
		if u, err2 := url.Parse(pc.RedirectURI); err2 == nil {
			origin = u.Scheme + "://" + u.Host
		}
		json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]interface{}{
			"popup":         true,
			"access_token":  accessToken,
			"refresh_token": refreshToken,
			"state":         pc.State,
			"origin":        origin,
			"redirect":      finalURL,
		})
		return
	}

	json.NewEncoder(c.Ctx.ResponseWriter).Encode(map[string]string{"redirect": finalURL})
}
