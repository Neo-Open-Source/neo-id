// Feature: neo-id-oidc-refactor, Property 8: Обязательные claims в ID_Token

package controllers

import (
	"testing"

	"unified-id/models"

	"github.com/golang-jwt/jwt/v5"
	"pgregory.net/rapid"
)

// TestPropertyP8_RequiredClaims verifies that for any user/site/nonce combination,
// the decoded ID_Token payload contains the required OIDC claims:
// iss, sub, aud, exp, iat — and nonce when a non-empty nonce is provided.
//
// Validates: Requirements 2.3 (обязательные claims в ID_Token)
func TestPropertyP8_RequiredClaims(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		unifiedID := rapid.StringMatching(`[a-zA-Z0-9_-]{4,32}`).Draw(t, "unifiedID")
		email := rapid.StringMatching(`[a-z]{3,10}@[a-z]{3,8}\.[a-z]{2,4}`).Draw(t, "email")
		displayName := rapid.StringMatching(`[a-zA-Z ]{2,30}`).Draw(t, "displayName")
		siteID := rapid.StringMatching(`[a-zA-Z0-9_-]{4,20}`).Draw(t, "siteID")
		useNonce := rapid.Bool().Draw(t, "useNonce")
		nonce := ""
		if useNonce {
			nonce = rapid.StringMatching(`[a-zA-Z0-9]{8,32}`).Draw(t, "nonce")
		}

		user := &models.User{
			UnifiedID:   unifiedID,
			Email:       email,
			DisplayName: displayName,
		}
		site := &models.Site{
			SiteID: siteID,
		}

		tokenStr, err := generateIDToken(user, site, nonce)
		if err != nil {
			t.Fatalf("generateIDToken failed: %v", err)
		}

		// Reconstruct RSA public key from JWK to verify signature
		jwk := GlobalKeyManager.PublicKeyJWK()
		pubKey, err := jwkToRSAPublicKey(jwk)
		if err != nil {
			t.Fatalf("failed to reconstruct RSA public key: %v", err)
		}

		claims := jwt.MapClaims{}
		_, err = jwt.ParseWithClaims(tokenStr, claims, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return pubKey, nil
		})
		if err != nil {
			t.Fatalf("failed to parse/verify ID_Token: %v", err)
		}

		// Required claims must be present and non-empty
		for _, claim := range []string{"iss", "sub", "aud", "exp", "iat"} {
			val, ok := claims[claim]
			if !ok || val == nil {
				t.Fatalf("required claim %q is missing from ID_Token", claim)
			}
		}

		// nonce must be present when a non-empty nonce was provided
		if nonce != "" {
			val, ok := claims["nonce"]
			if !ok || val == nil {
				t.Fatalf("nonce claim missing from ID_Token when nonce=%q was provided", nonce)
			}
			if val.(string) != nonce {
				t.Fatalf("nonce claim mismatch: expected %q, got %q", nonce, val)
			}
		}
	})
}
