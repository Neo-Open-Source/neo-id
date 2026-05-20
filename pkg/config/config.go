package config

import (
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
)

type Config struct {
	Server   ServerConfig
	Database DatabaseConfig
	JWT      JWTConfig
	OAuth    OAuthConfig
	Email    EmailConfig
	Upload   UploadConfig
}

type ServerConfig struct {
	Port            int
	AllowedOrigins  string
	BaseURL         string
	FrontendDevURL  string
	SessionLifetime time.Duration
}

type DatabaseConfig struct {
	MongoURI string
}

type JWTConfig struct {
	Secret        string
	SessionSecret string
}

type OAuthConfig struct {
	GoogleClientID     string
	GoogleClientSecret string
	GitHubClientID     string
	GitHubClientSecret string
	YandexClientID     string
	YandexClientSecret string
	VKClientID         string
	VKClientSecret     string
}

type EmailConfig struct {
	ResendAPIKey string
	ResendFrom   string
}

type UploadConfig struct {
	ImageKitPrivateKey string
}

func Load() (*Config, error) {
	_ = godotenv.Load()

	port, _ := strconv.Atoi(getEnv("PORT", "8080"))

	return &Config{
		Server: ServerConfig{
			Port:            port,
			AllowedOrigins:  getEnv("ALLOWED_ORIGINS", "http://localhost:3000"),
			BaseURL:         getEnv("BASE_URL", "http://localhost:8080"),
			FrontendDevURL:  getEnv("FRONTEND_DEV_URL", ""),
			SessionLifetime: 30 * 24 * time.Hour,
		},
		Database: DatabaseConfig{
			MongoURI: getEnv("MONGODB_URI", ""),
		},
		JWT: JWTConfig{
			Secret:        getEnv("JWT_SECRET", ""),
			SessionSecret: getEnv("SESSION_SECRET", ""),
		},
		OAuth: OAuthConfig{
			GoogleClientID:     getEnv("GOOGLE_CLIENT_ID", ""),
			GoogleClientSecret: getEnv("GOOGLE_CLIENT_SECRET", ""),
			GitHubClientID:     getEnv("GITHUB_CLIENT_ID", ""),
			GitHubClientSecret: getEnv("GITHUB_CLIENT_SECRET", ""),
			YandexClientID:     getEnv("YANDEX_CLIENT_ID", ""),
			YandexClientSecret: getEnv("YANDEX_CLIENT_SECRET", ""),
			VKClientID:         getEnv("VK_CLIENT_ID", ""),
			VKClientSecret:     getEnv("VK_CLIENT_SECRET", ""),
		},
		Email: EmailConfig{
			ResendAPIKey: getEnv("RESEND_API_KEY", ""),
			ResendFrom:   getEnv("RESEND_FROM", "Neo ID <no-reply@neoid.dev>"),
		},
		Upload: UploadConfig{
			ImageKitPrivateKey: getEnv("IMAGEKIT_PRIVATE_KEY", ""),
		},
	}, nil
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
