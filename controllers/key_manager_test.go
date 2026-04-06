package controllers

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/pem"
	"os"
	"strings"
	"testing"

	"github.com/golang-jwt/jwt/v5"
)

// generateTestPEM creates a fresh RSA-2048 PEM string for use in tests.
func generateTestPEM(t *testing.T) string {
	t.Helper()
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatalf("failed to generate RSA key: %v", err)
	}
	block := &pem.Block{
		Type:  "RSA PRIVATE KEY",
		Bytes: x509.MarshalPKCS1PrivateKey(key),
	}
	return string(pem.EncodeToMemory(block))
}

// clearKeyEnvVars unsets both key env vars and restores them after the test.
func clearKeyEnvVars(t *testing.T) {
	t.Helper()
	prev1 := os.Getenv("RSA_PRIVATE_KEY")
	prev2 := os.Getenv("RSA_PRIVATE_KEY_FILE")
	os.Unsetenv("RSA_PRIVATE_KEY")
	os.Unsetenv("RSA_PRIVATE_KEY_FILE")
	t.Cleanup(func() {
		os.Setenv("RSA_PRIVATE_KEY", prev1)
		os.Setenv("RSA_PRIVATE_KEY_FILE", prev2)
	})
}

// TestKeyManager_AutoGenerate verifies that NewKeyManager auto-generates a key
// when no env vars are set.
func TestKeyManager_AutoGenerate(t *testing.T) {
	clearKeyEnvVars(t)

	km, err := NewKeyManager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if km.privateKey == nil {
		t.Error("privateKey should not be nil")
	}
	if km.Kid() == "" {
		t.Error("kid should not be empty")
	}
}

// TestKeyManager_FromEnvVar verifies loading a key from RSA_PRIVATE_KEY env var.
func TestKeyManager_FromEnvVar(t *testing.T) {
	clearKeyEnvVars(t)

	pemStr := generateTestPEM(t)
	os.Setenv("RSA_PRIVATE_KEY", pemStr)

	km, err := NewKeyManager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if km.privateKey == nil {
		t.Error("privateKey should not be nil")
	}
	if km.Kid() == "" {
		t.Error("kid should not be empty")
	}
}

// TestKeyManager_FromFile verifies loading a key from RSA_PRIVATE_KEY_FILE env var.
func TestKeyManager_FromFile(t *testing.T) {
	clearKeyEnvVars(t)

	pemStr := generateTestPEM(t)

	f, err := os.CreateTemp("", "rsa_key_*.pem")
	if err != nil {
		t.Fatalf("failed to create temp file: %v", err)
	}
	defer os.Remove(f.Name())

	if _, err := f.WriteString(pemStr); err != nil {
		t.Fatalf("failed to write PEM to temp file: %v", err)
	}
	f.Close()

	os.Setenv("RSA_PRIVATE_KEY_FILE", f.Name())

	km, err := NewKeyManager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if km.privateKey == nil {
		t.Error("privateKey should not be nil")
	}
	if km.Kid() == "" {
		t.Error("kid should not be empty")
	}
}

// TestKeyManager_InvalidPEM verifies that an invalid PEM returns an error.
func TestKeyManager_InvalidPEM(t *testing.T) {
	clearKeyEnvVars(t)

	os.Setenv("RSA_PRIVATE_KEY", "not-a-valid-pem")

	_, err := NewKeyManager()
	if err == nil {
		t.Error("expected error for invalid PEM, got nil")
	}
}

// TestKeyManager_Sign verifies that Sign produces a valid RS256 JWT with the correct kid.
func TestKeyManager_Sign(t *testing.T) {
	clearKeyEnvVars(t)

	km, err := NewKeyManager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	claims := jwt.MapClaims{"sub": "test-user", "iss": "test"}
	tokenStr, err := km.Sign(claims)
	if err != nil {
		t.Fatalf("Sign() returned error: %v", err)
	}
	if tokenStr == "" {
		t.Fatal("Sign() returned empty string")
	}

	// Parse and verify the token using the public key.
	parsed, err := jwt.Parse(tokenStr, func(tok *jwt.Token) (interface{}, error) {
		if _, ok := tok.Method.(*jwt.SigningMethodRSA); !ok {
			t.Errorf("unexpected signing method: %v", tok.Header["alg"])
		}
		return &km.privateKey.PublicKey, nil
	})
	if err != nil {
		t.Fatalf("failed to parse signed token: %v", err)
	}
	if !parsed.Valid {
		t.Error("parsed token is not valid")
	}

	// Verify kid header.
	kid, ok := parsed.Header["kid"].(string)
	if !ok || kid == "" {
		t.Error("kid header missing or empty")
	}
	if kid != km.Kid() {
		t.Errorf("kid mismatch: got %q, want %q", kid, km.Kid())
	}
}

// TestKeyManager_PublicKeyJWK verifies the JWK map fields.
func TestKeyManager_PublicKeyJWK(t *testing.T) {
	clearKeyEnvVars(t)

	km, err := NewKeyManager()
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	jwk := km.PublicKeyJWK()

	checks := map[string]string{
		"kty": "RSA",
		"use": "sig",
		"alg": "RS256",
		"kid": km.Kid(),
	}
	for field, want := range checks {
		got, ok := jwk[field].(string)
		if !ok {
			t.Errorf("field %q missing or not a string", field)
			continue
		}
		if got != want {
			t.Errorf("field %q: got %q, want %q", field, got, want)
		}
	}

	for _, field := range []string{"n", "e"} {
		val, ok := jwk[field].(string)
		if !ok || strings.TrimSpace(val) == "" {
			t.Errorf("field %q should be a non-empty string", field)
		}
	}
}
