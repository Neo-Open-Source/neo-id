package controllers

import (
	"encoding/json"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
	"unified-id/models"
)

type geoIPResult struct {
	Country string `json:"country"`
	City    string `json:"city"`
}

// lookupGeoIP returns country and city for an IP address using ip-api.com (free, no key needed).
// Returns empty strings on any error or for private/loopback IPs.
func lookupGeoIP(rawIP string) (country, city string) {
	ip := extractIP(rawIP)
	if ip == "" {
		return "", ""
	}

	parsed := net.ParseIP(ip)
	if parsed == nil || parsed.IsLoopback() || parsed.IsPrivate() || parsed.IsUnspecified() {
		return "", ""
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Get("http://ip-api.com/json/" + ip + "?fields=country,city,status")
	if err != nil {
		return "", ""
	}
	defer resp.Body.Close()

	var result struct {
		Status  string `json:"status"`
		Country string `json:"country"`
		City    string `json:"city"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil || result.Status != "success" {
		return "", ""
	}
	return result.Country, result.City
}

// extractIP strips port and returns clean IP, preferring X-Forwarded-For / X-Real-IP
func extractIP(raw string) string {
	// Strip port
	ip := raw
	if host, _, err := net.SplitHostPort(raw); err == nil {
		ip = host
	}
	return strings.TrimSpace(ip)
}

// getRealIP extracts the real client IP from request headers
func getRealIP(r *http.Request) string {
	// X-Forwarded-For can be a comma-separated list; take the first
	if xff := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); xff != "" {
		parts := strings.Split(xff, ",")
		if ip := strings.TrimSpace(parts[0]); ip != "" {
			return ip
		}
	}
	if xri := strings.TrimSpace(r.Header.Get("X-Real-IP")); xri != "" {
		return xri
	}
	// Fall back to RemoteAddr
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil {
		return host
	}
	return r.RemoteAddr
}

// createSessionWithGeo creates a session and asynchronously resolves geo info
func createSessionWithGeo(sess *models.Session) {
	// Resolve geo in background to not block the response
	go func() {
		country, city := lookupGeoIP(sess.IPAddress)
		if country == "" && city == "" {
			return
		}
		sessionCRUD := models.NewSessionCRUD()
		_ = sessionCRUD.SetGeo(sess.Token, country, city)
	}()
}

// makeSession creates a Session struct and triggers async geo lookup
func makeSession(token, userID, ip, ua string, months int, refreshToken string, refreshExp time.Time) *models.Session {
	if months < 1 {
		months = 1
	}
	s := &models.Session{
		Token:                 token,
		UserID:                userID,
		ExpiresAt:             time.Now().Add(24 * time.Hour),
		IPAddress:             ip,
		UserAgent:             ua,
		RefreshToken:          refreshToken,
		RefreshExpiresAt:      refreshExp,
		RefreshDurationMonths: months,
		LastUsedAt:            time.Now(),
	}
	return s
}

// enforceSessionLimit ensures a user has fewer than 10 active sessions.
// If the limit is reached, the oldest session is deleted. Errors are logged but do not block session creation.
func enforceSessionLimit(userID string) {
	sessionCRUD := models.NewSessionCRUD()
	count, err := sessionCRUD.CountUserSessions(userID)
	if err != nil {
		log.Printf("enforceSessionLimit: count error for user %s: %v", userID, err)
		return
	}
	if count >= 10 {
		if err := sessionCRUD.DeleteOldestSession(userID); err != nil {
			log.Printf("enforceSessionLimit: delete oldest error for user %s: %v", userID, err)
		}
	}
}

func max(a, b int) int {
	if a > b {
		return a
	}
	return b
}

// totpValidate is a package-level wrapper so user.go can call it without importing pquerna/otp
func totpValidate(code, secret string) bool {
	return totpValidateCode(code, secret)
}

// setAuthCookie sets a cross-subdomain cookie with the access token
// so popup windows on id.neomovies.ru can detect existing sessions
func setAuthCookie(w http.ResponseWriter, token string) {
	baseURL := strings.TrimSpace(os.Getenv("BASE_URL"))
	// Extract root domain for cookie (e.g. id.neomovies.ru → .neomovies.ru)
	cookieDomain := ""
	if baseURL != "" {
		if u, err := url.Parse(baseURL); err == nil {
			host := u.Hostname()
			parts := strings.Split(host, ".")
			if len(parts) >= 2 {
				cookieDomain = "." + strings.Join(parts[len(parts)-2:], ".")
			}
		}
	}

	secure := strings.HasPrefix(strings.ToLower(baseURL), "https://")
	sameSite := "Lax"
	if secure {
		sameSite = "None"
	}

	cookie := &http.Cookie{
		Name:     "neo_id_token",
		Value:    token,
		Path:     "/",
		MaxAge:   3600 * 24 * 30,
		HttpOnly: false, // must be readable by JS for popup detection
		Secure:   secure,
		SameSite: http.SameSiteLaxMode,
	}
	if secure {
		cookie.SameSite = http.SameSiteNoneMode
	}
	if cookieDomain != "" {
		cookie.Domain = cookieDomain
	}

	_ = sameSite // used above
	http.SetCookie(w, cookie)
}
