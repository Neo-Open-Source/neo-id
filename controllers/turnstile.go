package controllers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/beego/beego/v2/server/web"
)

const turnstileVerifyURL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

type turnstileVerifyResponse struct {
	Success    bool     `json:"success"`
	ErrorCodes []string `json:"error-codes"`
}

func turnstileSecret() string {
	return strings.TrimSpace(firstNonEmpty(
		os.Getenv("TURNSTILE_SECRET_KEY"),
		web.AppConfig.DefaultString("turnstile_secret_key", ""),
	))
}

func verifyTurnstileToken(token, remoteIP string) error {
	secret := turnstileSecret()
	if secret == "" {
		return errors.New("turnstile is not configured")
	}
	if strings.TrimSpace(token) == "" {
		return errors.New("turnstile token is required")
	}

	form := url.Values{}
	form.Set("secret", secret)
	form.Set("response", strings.TrimSpace(token))
	if strings.TrimSpace(remoteIP) != "" {
		form.Set("remoteip", strings.TrimSpace(remoteIP))
	}

	resp, err := http.PostForm(turnstileVerifyURL, form)
	if err != nil {
		return errors.New("failed to verify turnstile token")
	}
	defer resp.Body.Close()

	var verifyResp turnstileVerifyResponse
	if err := json.NewDecoder(resp.Body).Decode(&verifyResp); err != nil {
		return errors.New("invalid turnstile verification response")
	}
	if !verifyResp.Success {
		return errors.New("turnstile verification failed")
	}

	return nil
}
