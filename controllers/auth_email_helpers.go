package controllers

import (
	"bytes"
	"crypto/rand"
	"encoding/json"
	"fmt"
	"html"
	"io"
	"math/big"
	"net/http"
	"os"
	"strings"
	"time"
)

func sendResendEmail(toEmail string, subject string, htmlBody string) error {
	apiKey := strings.TrimSpace(os.Getenv("RESEND_API_KEY"))
	from := strings.TrimSpace(os.Getenv("RESEND_FROM"))
	if apiKey == "" || from == "" {
		return fmt.Errorf("email sending is not configured")
	}

	payload := map[string]interface{}{
		"from":    from,
		"to":      []string{toEmail},
		"subject": subject,
		"html":    htmlBody,
	}
	body, _ := json.Marshal(payload)

	req, err := http.NewRequest(http.MethodPost, "https://api.resend.com/emails", bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		b, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("email provider error: %s", strings.TrimSpace(string(b)))
	}

	return nil
}

func generateEmailVerificationCode() (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1000000))
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("%06d", n.Int64()), nil
}

func buildMFACodeHTML(code string) string {
	escapedCode := html.EscapeString(code)
	return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:40px 32px;" cellpadding="0" cellspacing="0">
      <tr><td>
        <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
        <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Your login code</div>
        <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Use this code to sign in. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.</div>
        <div style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
          <div style="font-size:11px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Login code</div>
          <div style="font-size:40px;font-weight:700;color:#111111;letter-spacing:0.25em;">` + escapedCode + `</div>
        </div>
        <div style="font-size:12px;color:#999999;line-height:1.5;">This code is valid for 10 minutes and can only be used once.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}

func buildEmailVerificationHTML(code string, verifyURL string) string {
	escapedCode := html.EscapeString(code)
	escapedURL := html.EscapeString(verifyURL)
	return `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:40px 32px;" cellpadding="0" cellspacing="0">
      <tr><td>
        <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
        <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Verify your email</div>
        <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Enter this code to confirm your email address and activate your account.</div>
        <div style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
          <div style="font-size:11px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Verification code</div>
          <div style="font-size:40px;font-weight:700;color:#111111;letter-spacing:0.25em;">` + escapedCode + `</div>
          <div style="font-size:12px;color:#999999;margin-top:10px;">Expires in 30 minutes</div>
        </div>
        <div style="text-align:center;margin-bottom:32px;">
          <a href="` + escapedURL + `" style="display:inline-block;padding:12px 24px;background:#111111;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Verify by link instead</a>
        </div>
        <div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't create a Neo ID account, you can safely ignore this email.</div>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`
}
