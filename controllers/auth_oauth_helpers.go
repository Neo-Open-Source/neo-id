package controllers

import (
	"fmt"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
	"github.com/gorilla/sessions"
	"github.com/markbates/goth/gothic"
)

const oauthSessionName = "unified_id_oauth"

func getOAuthCookieSession(r *http.Request) (*sessions.Session, error) {
	if gothic.Store == nil {
		return nil, fmt.Errorf("oauth store not initialized")
	}
	s, err := gothic.Store.Get(r, oauthSessionName)
	if err != nil {
		fresh, newErr := gothic.Store.New(r, oauthSessionName)
		if newErr != nil {
			fallback := sessions.NewSession(gothic.Store, oauthSessionName)
			fallback.IsNew = true
			fallback.Options = &sessions.Options{Path: "/", HttpOnly: true}
			return fallback, nil
		}
		return fresh, nil
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

func getBaseURL() string {
	baseUrl := os.Getenv("BASE_URL")
	if strings.TrimSpace(baseUrl) == "" {
		baseUrl = web.AppConfig.DefaultString("base_url", "http://localhost:8080")
	}
	return strings.TrimRight(strings.TrimSpace(baseUrl), "/")
}

// publicAvatarURL converts stored avatar paths like "/avatars/..." into absolute URLs
// for third-party integrations. External URLs are returned as-is.
func publicAvatarURL(avatar string) string {
	avatar = strings.TrimSpace(avatar)
	if avatar == "" {
		return ""
	}
	if strings.HasPrefix(avatar, "https://") || strings.HasPrefix(avatar, "http://") || strings.HasPrefix(avatar, "data:") {
		return avatar
	}
	base := getBaseURL()
	if strings.HasPrefix(avatar, "/") {
		return base + avatar
	}
	return base + "/" + avatar
}
