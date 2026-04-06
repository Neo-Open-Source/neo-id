// Feature: neo-id-oidc-refactor, Property 6: kid в ID_Token совпадает с JWKS
// Feature: neo-id-oidc-refactor, Property 7: ID_Token подписан RS256

package controllers

import (
	"crypto/rsa"
	"encoding/base64"
	"math/big"
	"strings"
	"testing"

	"unified-id/models"

	"github.com/golang-jwt/jwt/v5"
	"pgregory.net/rapid"
)

func init() {
	if GlobalKeyManager == nil {
		km, err := NewKeyManager()
		if err != nil {
			panic("failed to initialize GlobalKeyManager for tests: " + err.Error())
		}
		GlobalKeyManager = km
	}
}

// TestPropertyP6_KidMatchesJWKS verifies that for any user/site/nonce combination,
// the kid in the ID_Token header matches the kid in GlobalKeyManager.PublicKeyJWK().
//
// Validates: Requirements 2.2 (kid в заголовке токена)
func TestPropertyP6_KidMatchesJWKS(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		unifiedID := rapid.StringMatching(`[a-zA-Z0-9_-]{4,32}`).Draw(t, "unifiedID")
		email := rapid.StringMatching(`[a-z]{3,10}@[a-z]{3,8}\.[a-z]{2,4}`).Draw(t, "email")
		siteID := rapid.StringMatching(`[a-zA-Z0-9_-]{4,20}`).Draw(t, "siteID")
		useNonce := rapid.Bool().Draw(t, "useNonce")
		nonce := ""
		if useNonce {
			nonce = rapid.StringMatching(`[a-zA-Z0-9]{8,32}`).Draw(t, "nonce")
		}

		user := &models.User{
			UnifiedID: unifiedID,
			Email:     email,
		}
		site := &models.Site{
			SiteID: siteID,
		}

		tokenStr, err := generateIDToken(user, site, nonce)
		if err != nil {
			t.Fatalf("generateIDToken failed: %v", err)
		}

		// Parse without verification to extract header
		parts := strings.Split(tokenStr, ".")
		if len(parts) != 3 {
			t.Fatalf("expected 3 JWT parts, got %d", len(parts))
		}

		headerJSON, err := base64.RawURLEncoding.DecodeString(parts[0])
		if err != nil {
			t.Fatalf("failed to decode JWT header: %v", err)
		}

		// Parse header manually
		tok, _, err := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
		if err != nil {
			t.Fatalf("failed to parse JWT: %v", err)
		}
		_ = headerJSON

		kidFromToken, ok := tok.Header["kid"].(string)
		if !ok || kidFromToken == "" {
			t.Fatalf("kid missing or empty in token header")
		}

		jwk := GlobalKeyManager.PublicKeyJWK()
		kidFromJWK, ok := jwk["kid"].(string)
		if !ok || kidFromJWK == "" {
			t.Fatalf("kid missing or empty in JWKS")
		}

		if kidFromToken != kidFromJWK {
			t.Fatalf("kid mismatch: token=%q, jwks=%q", kidFromToken, kidFromJWK)
		}
	})
}

// TestPropertyP7_IDTokenRS256 verifies that for any user/site/nonce combination,
// the ID_Token alg header is "RS256" and the token verifies with the RSA public key.
//
// Validates: Requirements 2.1 (RS256 подпись ID_Token)
func TestPropertyP7_IDTokenRS256(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		unifiedID := rapid.StringMatching(`[a-zA-Z0-9_-]{4,32}`).Draw(t, "unifiedID")
		email := rapid.StringMatching(`[a-z]{3,10}@[a-z]{3,8}\.[a-z]{2,4}`).Draw(t, "email")
		siteID := rapid.StringMatching(`[a-zA-Z0-9_-]{4,20}`).Draw(t, "siteID")
		useNonce := rapid.Bool().Draw(t, "useNonce")
		nonce := ""
		if useNonce {
			nonce = rapid.StringMatching(`[a-zA-Z0-9]{8,32}`).Draw(t, "nonce")
		}

		user := &models.User{
			UnifiedID: unifiedID,
			Email:     email,
		}
		site := &models.Site{
			SiteID: siteID,
		}

		tokenStr, err := generateIDToken(user, site, nonce)
		if err != nil {
			t.Fatalf("generateIDToken failed: %v", err)
		}

		// Check alg header
		tok, _, err := new(jwt.Parser).ParseUnverified(tokenStr, jwt.MapClaims{})
		if err != nil {
			t.Fatalf("failed to parse JWT: %v", err)
		}

		alg, ok := tok.Header["alg"].(string)
		if !ok || alg != "RS256" {
			t.Fatalf("expected alg=RS256, got %q", alg)
		}

		// Reconstruct RSA public key from JWK and verify signature
		jwk := GlobalKeyManager.PublicKeyJWK()
		pubKey, err := jwkToRSAPublicKey(jwk)
		if err != nil {
			t.Fatalf("failed to reconstruct RSA public key from JWK: %v", err)
		}

		parsed, err := jwt.Parse(tokenStr, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodRSA); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return pubKey, nil
		})
		if err != nil {
			t.Fatalf("token signature verification failed: %v", err)
		}
		if !parsed.Valid {
			t.Fatalf("token is not valid after RS256 verification")
		}
	})
}

// jwkToRSAPublicKey reconstructs an *rsa.PublicKey from a JWK map (n, e fields).
func jwkToRSAPublicKey(jwk map[string]interface{}) (*rsa.PublicKey, error) {
	nStr, _ := jwk["n"].(string)
	eStr, _ := jwk["e"].(string)

	nBytes, err := base64.RawURLEncoding.DecodeString(nStr)
	if err != nil {
		return nil, err
	}
	eBytes, err := base64.RawURLEncoding.DecodeString(eStr)
	if err != nil {
		return nil, err
	}

	n := new(big.Int).SetBytes(nBytes)
	e := int(new(big.Int).SetBytes(eBytes).Int64())

	return &rsa.PublicKey{N: n, E: e}, nil
}
