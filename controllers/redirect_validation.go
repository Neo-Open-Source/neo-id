package controllers

import (
	"fmt"
	"net/url"
	"os"
	"strings"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
)

func getAllowedAppSchemes() map[string]struct{} {
	s := strings.TrimSpace(os.Getenv("ALLOWED_APP_SCHEMES"))
	if s == "" {
		s = web.AppConfig.DefaultString("allowed_app_schemes", "")
	}

	allowed := map[string]struct{}{}
	for _, part := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ';' }) {
		v := strings.ToLower(strings.TrimSpace(part))
		if v == "" {
			continue
		}
		allowed[v] = struct{}{}
	}
	return allowed
}

func hostsFromAllowedOrigins(origins []string) map[string]struct{} {
	hosts := map[string]struct{}{}
	for _, o := range origins {
		o = strings.TrimSpace(o)
		if o == "" {
			continue
		}
		if !strings.Contains(o, "://") {
			o = "https://" + o
		}
		u, err := url.Parse(o)
		if err != nil {
			continue
		}
		h := strings.ToLower(strings.TrimSpace(u.Host))
		if h == "" {
			continue
		}
		hosts[h] = struct{}{}
	}
	return hosts
}

// isAllowedRedirectURL validates redirect URLs for OAuth flows.
// Allows:
// - HTTPS URLs matching allowed origins for registered sites.
// - Any custom app scheme for registered sites (e.g., neomovies://, myapp://).
// Does NOT allow open redirects to arbitrary http/https hosts.
func isAllowedRedirectURL(redirectURL string, site *models.Site) error {
	if redirectURL == "" {
		return fmt.Errorf("redirect_url cannot be empty")
	}

	parsed, err := url.Parse(redirectURL)
	if err != nil {
		return fmt.Errorf("invalid redirect URL format")
	}

	scheme := strings.ToLower(parsed.Scheme)
	host := parsed.Host

	// Allow any custom app scheme (non-http/https) for registered sites
	if scheme != "http" && scheme != "https" {
		// Basic validation: must have scheme and path, no empty host
		if scheme == "" || parsed.Opaque != "" {
			return fmt.Errorf("invalid custom scheme format")
		}
		return nil
	}

	// For http/https, enforce allowed origins
	if scheme == "http" || scheme == "https" {
		// Build allowed origins list from site configuration
		allowedOrigins := []string{}
		if site != nil {
			for _, origin := range site.AllowedOrigins {
				allowedOrigins = append(allowedOrigins, origin)
			}
		}

		// Add default localhost for development
		allowedOrigins = append(allowedOrigins, "http://localhost:3000", "http://localhost:8080", "http://localhost:8081")

		// Check if host matches any allowed origin
		for _, allowedOrigin := range allowedOrigins {
			allowedURL, err := url.Parse(allowedOrigin)
			if err != nil {
				continue
			}
			if host == allowedURL.Host {
				return nil
			}
		}

		return fmt.Errorf("redirect host not allowed: %s", host)
	}

	return fmt.Errorf("unsupported redirect scheme: %s", scheme)
}

func withTokenAndState(raw string, token string, state string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", fmt.Errorf("invalid redirect_url")
	}
	q := u.Query()
	q.Set("token", token)
	q.Set("state", state)
	u.RawQuery = q.Encode()
	return u.String(), nil
}
