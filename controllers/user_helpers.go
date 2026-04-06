package controllers

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"strings"
	"time"

	"unified-id/models"

	"github.com/beego/beego/v2/server/web"
	"github.com/golang-jwt/jwt/v5"
)

// authenticateUser validates the Bearer token and returns the authenticated user.
func (c *UserController) authenticateUser() (*models.User, error) {
	token := c.Ctx.Request.Header.Get("Authorization")
	if token != "" {
		token = strings.TrimPrefix(token, "Bearer ")
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

	if user.IsBanned {
		if user.BannedUntil != nil && time.Now().After(*user.BannedUntil) {
			userCRUD.UnbanUser(user.UnifiedID)
			user.IsBanned = false
		} else {
			return nil, nil
		}
	}

	return user, nil
}

// isDeveloper returns true if the user has developer/admin/moderator role.
func (c *UserController) isDeveloper(user *models.User) bool {
	if user == nil {
		return false
	}
	role := strings.ToLower(strings.TrimSpace(user.Role))
	return role == "developer" || role == "admin" || role == "moderator"
}

// uploadToImageKit uploads image bytes to ImageKit and returns the CDN URL.
func uploadToImageKit(data []byte, filename string) (string, error) {
	privateKey := strings.TrimSpace(os.Getenv("IMAGEKIT_PRIVATE_KEY"))
	if privateKey == "" {
		privateKey = strings.TrimSpace(web.AppConfig.DefaultString("imagekit_private_key", ""))
	}
	if privateKey == "" {
		return "", fmt.Errorf("IMAGEKIT_PRIVATE_KEY not configured")
	}

	var buf bytes.Buffer
	w := multipart.NewWriter(&buf)

	fw, err := w.CreateFormFile("file", filename)
	if err != nil {
		return "", err
	}
	if _, err = fw.Write(data); err != nil {
		return "", err
	}
	_ = w.WriteField("fileName", filename)
	_ = w.WriteField("folder", "/avatars")
	_ = w.WriteField("useUniqueFileName", "true")
	w.Close()

	req, err := http.NewRequest(http.MethodPost, "https://upload.imagekit.io/api/v1/files/upload", &buf)
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	req.SetBasicAuth(privateKey, "")

	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", fmt.Errorf("imagekit error %d: %s", resp.StatusCode, strings.TrimSpace(string(body)))
	}

	var result struct {
		URL string `json:"url"`
	}
	if err := json.Unmarshal(body, &result); err != nil || result.URL == "" {
		return "", fmt.Errorf("imagekit: unexpected response: %s", string(body))
	}
	return result.URL, nil
}
