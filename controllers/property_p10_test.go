// Feature: neo-id-oidc-refactor, Property 10: PKCE S256 верификация

package controllers

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"

	"pgregory.net/rapid"
)

// TestPropertyP10_PKCES256Valid verifies that for any random code_verifier,
// computing BASE64URL(SHA256(verifier)) and passing it as challenge with method "S256" returns true.
//
// Validates: Requirements 10.7 (PKCE S256 верификация)
func TestPropertyP10_PKCES256Valid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// RFC 7636: code_verifier is 43-128 printable ASCII characters [A-Za-z0-9\-._~]
		verifier := rapid.StringMatching(`[A-Za-z0-9\-._~]{43,128}`).Draw(t, "verifier")

		h := sha256.Sum256([]byte(verifier))
		challenge := base64.RawURLEncoding.EncodeToString(h[:])

		if !verifyCodeChallenge(verifier, challenge, "S256") {
			t.Fatalf("verifyCodeChallenge returned false for valid S256 challenge: verifier=%q", verifier)
		}
	})
}

// TestPropertyP10_PKCES256Invalid verifies that for any random code_verifier,
// passing a different (incorrect) challenge with method "S256" returns false.
//
// Validates: Requirements 10.7 (PKCE S256 верификация)
func TestPropertyP10_PKCES256Invalid(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		verifier := rapid.StringMatching(`[A-Za-z0-9\-._~]{43,128}`).Draw(t, "verifier")

		// Compute the correct challenge, then mutate it to ensure it's different
		h := sha256.Sum256([]byte(verifier))
		correctChallenge := base64.RawURLEncoding.EncodeToString(h[:])

		// Generate a wrong challenge: use a different verifier to produce a different hash
		wrongVerifier := rapid.StringMatching(`[A-Za-z0-9\-._~]{43,128}`).Draw(t, "wrongVerifier")
		h2 := sha256.Sum256([]byte(wrongVerifier))
		wrongChallenge := base64.RawURLEncoding.EncodeToString(h2[:])

		// Only test when the challenges are actually different
		if wrongChallenge == correctChallenge {
			t.Skip("generated identical challenges, skipping")
		}

		if verifyCodeChallenge(verifier, wrongChallenge, "S256") {
			t.Fatalf("verifyCodeChallenge returned true for wrong S256 challenge: verifier=%q, wrongChallenge=%q", verifier, wrongChallenge)
		}
	})
}
