package controllers

import (
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
)

// authenticateSite authenticates a site using API key from header.
func (c *SiteController) authenticateSite() (*models.Site, error) {
	apiKey := strings.TrimSpace(c.Ctx.Request.Header.Get("X-API-Key"))
	if apiKey == "" {
		auth := c.Ctx.Request.Header.Get("Authorization")
		if auth != "" {
			apiKey = strings.TrimSpace(strings.TrimPrefix(auth, "Bearer "))
		}
	}
	if apiKey == "" {
		return nil, nil
	}

	siteCRUD := models.NewSiteCRUD()
	site, err := siteCRUD.GetSiteByAPIKey(apiKey)
	if err != nil || site == nil || !site.IsActive {
		return nil, nil
	}
	return site, nil
}

// buildAllowedOrigins creates appropriate allowed origins based on domain type.
func buildAllowedOrigins(domain string) []string {
	lower := strings.ToLower(domain)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return []string{domain, "http://localhost:3000"}
	} else if strings.Contains(domain, "://") {
		return []string{"http://localhost:3000"}
	} else if strings.Contains(domain, ":") && !strings.Contains(domain, "/") {
		return []string{"http://localhost:3000"}
	} else {
		return []string{"https://" + domain, "https://www." + domain, "http://localhost:3000"}
	}
}

// mergeAllowedOrigins merges two origin slices, deduplicating by lowercase key.
func mergeAllowedOrigins(base []string, extra []string) []string {
	out := []string{}
	seen := map[string]struct{}{}
	for _, v := range append(base, extra...) {
		vv := strings.TrimSpace(v)
		if vv == "" {
			continue
		}
		key := strings.ToLower(vv)
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, vv)
	}
	return out
}

// buildRedirectURI creates appropriate redirect URI based on domain type.
func buildRedirectURI(domain string) string {
	lower := strings.ToLower(domain)
	if strings.HasPrefix(lower, "http://") || strings.HasPrefix(lower, "https://") {
		return domain + "/auth/callback"
	} else if strings.Contains(domain, "://") {
		if strings.HasSuffix(domain, "/") {
			return domain + "auth/callback"
		}
		return domain + "/auth/callback"
	} else if strings.Contains(domain, ":") && !strings.Contains(domain, "/") {
		if strings.HasSuffix(domain, ":") {
			return domain + "//auth/callback"
		}
		return domain + "://auth/callback"
	} else {
		return "https://" + domain + "/auth/callback"
	}
}

// getAuthenticatedUser validates the Bearer token and returns the authenticated user.
func (c *SiteController) getAuthenticatedUser() (*models.User, error) {
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
	}
	if strings.TrimSpace(token) == "" {
		token = strings.TrimSpace(c.GetString("token"))
	}
	if token == "" {
		return nil, nil
	}

	claims := &Claims{}
	jwtToken, err := jwt.ParseWithClaims(token, claims, func(token *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(secret) == "" {
			secret = web.AppConfig.DefaultString("jwt_secret", "")
		}
		return []byte(secret), nil
	})
	if err != nil || !jwtToken.Valid {
		return nil, nil
	}

	sessionCRUD := models.NewSessionCRUD()
	session, err := sessionCRUD.GetSessionByToken(token)
	if err != nil || session == nil {
		return nil, nil
	}

	userCRUD := models.NewUserCRUD()
	user, err := userCRUD.GetUserByUnifiedID(claims.UnifiedID)
	if err != nil || user == nil {
		return nil, nil
	}
	return user, nil
}

// generateSiteToken generates a site-specific JWT token for a user.
func (c *SiteController) generateSiteToken(userID, siteID string) (string, error) {
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
	secret := os.Getenv("JWT_SECRET")
	if strings.TrimSpace(secret) == "" {
		secret = web.AppConfig.DefaultString("jwt_secret", "")
	}
	return token.SignedString([]byte(secret))
}

// verifySiteToken verifies and decodes a site-specific token.
func (c *SiteController) verifySiteToken(tokenString string) (string, string, error) {
	claims := &struct {
		UserID string `json:"user_id"`
		SiteID string `json:"site_id"`
		jwt.RegisteredClaims
	}{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(token *jwt.Token) (interface{}, error) {
		secret := os.Getenv("JWT_SECRET")
		if strings.TrimSpace(secret) == "" {
			secret = web.AppConfig.DefaultString("jwt_secret", "")
		}
		return []byte(secret), nil
	})
	if err != nil || !token.Valid {
		return "", "", err
	}
	return claims.UserID, claims.SiteID, nil
}

// withTokenAndState is re-exported here for use within site_oauth.go
// (actual implementation lives in redirect_validation.go)
