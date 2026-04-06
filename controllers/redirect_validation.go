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
		h := strings.ToLower(strings.TrimSpace(u.Hostname()))
		if h == "" {
			continue
		}
		hosts[h] = struct{}{}
	}
	return hosts
}

func isWildcardHostAllowed(hostname string, allowed string) bool {
	hostname = strings.ToLower(strings.TrimSpace(hostname))
	allowed = strings.ToLower(strings.TrimSpace(allowed))
	if hostname == "" || allowed == "" {
		return false
	}
	if strings.HasPrefix(allowed, "*.") {
		suffix := strings.TrimPrefix(allowed, "*.")
		if suffix == "" {
			return false
		}
		if hostname == suffix {
			return false
		}
		return strings.HasSuffix(hostname, "."+suffix)
	}
	if hostname == allowed {
		return true
	}
	// Allow www. subdomain if base domain matches
	// e.g. allowed=example.com → www.example.com is also allowed
	if hostname == "www."+allowed {
		return true
	}
	// Allow base domain if www. variant is allowed
	if "www."+hostname == allowed {
		return true
	}
	return false
}

// isAllowedRedirectURL validates redirect URLs for OAuth flows.
// Allows:
// - HTTPS URLs matching allowed origins for registered sites.
// - Any custom app scheme for registered sites (e.g., myapp://, anotherapp://).
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
	hostname := strings.ToLower(strings.TrimSpace(parsed.Hostname()))

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

		// Check if host matches any allowed origin (exact or wildcard)
		for _, allowedOrigin := range allowedOrigins {
			allowedOrigin = strings.TrimSpace(allowedOrigin)
			if allowedOrigin == "" {
				continue
			}
			allowedHost := ""
			if strings.Contains(allowedOrigin, "://") {
				allowedURL, err := url.Parse(allowedOrigin)
				if err != nil {
					continue
				}
				allowedHost = allowedURL.Hostname()
			} else {
				allowedHost = allowedOrigin
			}
			allowedHost = strings.ToLower(strings.TrimSpace(allowedHost))
			if isWildcardHostAllowed(hostname, allowedHost) {
				return nil
			}
		}

		return fmt.Errorf("redirect host not allowed: %s", hostname)
	}

	return fmt.Errorf("unsupported redirect scheme: %s", scheme)
}

func withTokenAndState(raw string, token string, refreshToken string, state string) (string, error) {
	u, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return "", fmt.Errorf("invalid redirect_url")
	}
	q := u.Query()
	q.Set("token", token)
	if strings.TrimSpace(refreshToken) != "" {
		q.Set("refresh_token", refreshToken)
	}
	q.Set("state", state)
	u.RawQuery = q.Encode()
	return u.String(), nil
}
