package controllers

import (
	"fmt"
	"net/http"
	"os"
	"strings"

	"github.com/beego/beego/v2/server/web"
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
	access, _, _, err := generateServiceTokensForCallback(userID, siteID, 1)
	return access, err
}

func getBaseURL() string {
	baseUrl := strings.TrimSpace(os.Getenv("BASE_URL"))
	if baseUrl == "" {
		// Vercel provides deployment host without scheme.
		if vercelHost := strings.TrimSpace(os.Getenv("VERCEL_URL")); vercelHost != "" {
			if strings.HasPrefix(vercelHost, "http://") || strings.HasPrefix(vercelHost, "https://") {
				baseUrl = vercelHost
			} else {
				baseUrl = "https://" + vercelHost
			}
		}
	}
	if baseUrl == "" {
		baseUrl = strings.TrimSpace(web.AppConfig.DefaultString("base_url", ""))
	}
	if baseUrl == "" {
		baseUrl = "http://localhost:8080"
	}
	return strings.TrimRight(baseUrl, "/")
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
