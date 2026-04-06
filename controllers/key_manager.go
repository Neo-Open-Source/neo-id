package controllers

import (
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"fmt"
	"math/big"
	"os"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// KeyManager manages the RSA key pair used for signing JWTs with RS256.
// It supports loading from RSA_PRIVATE_KEY env var (PEM), a file path, or auto-generating.
type KeyManager struct {
	privateKey *rsa.PrivateKey
	kid        string
}

// GlobalKeyManager is the singleton instance initialized at startup.
var GlobalKeyManager *KeyManager

// NewKeyManager creates a KeyManager by trying, in order:
//  1. RSA_PRIVATE_KEY env var (PEM-encoded)
//  2. RSA_PRIVATE_KEY_FILE env var (path to PEM file)
//  3. Auto-generate a new RSA-2048 key pair
func NewKeyManager() (*KeyManager, error) {
	var privateKey *rsa.PrivateKey

	// 1. Try env var (PEM string)
	if pemStr := os.Getenv("RSA_PRIVATE_KEY"); pemStr != "" {
		key, err := parseRSAPrivateKeyPEM([]byte(pemStr))
		if err != nil {
			return nil, fmt.Errorf("RSA_PRIVATE_KEY parse error: %w", err)
		}
		privateKey = key
	}

	// 2. Try file path
	if privateKey == nil {
		if filePath := os.Getenv("RSA_PRIVATE_KEY_FILE"); filePath != "" {
			data, err := os.ReadFile(filePath)
			if err != nil {
				return nil, fmt.Errorf("RSA_PRIVATE_KEY_FILE read error: %w", err)
			}
			key, err := parseRSAPrivateKeyPEM(data)
			if err != nil {
				return nil, fmt.Errorf("RSA_PRIVATE_KEY_FILE parse error: %w", err)
			}
			privateKey = key
		}
	}

	// 3. Auto-generate
	if privateKey == nil {
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			return nil, fmt.Errorf("RSA key generation error: %w", err)
		}
		privateKey = key
	}

	kid := uuid.New().String()

	return &KeyManager{
		privateKey: privateKey,
		kid:        kid,
	}, nil
}

// parseRSAPrivateKeyPEM decodes a PEM block and parses an RSA private key.
func parseRSAPrivateKeyPEM(data []byte) (*rsa.PrivateKey, error) {
	block, _ := pem.Decode(data)
	if block == nil {
		return nil, fmt.Errorf("failed to decode PEM block")
	}
	switch block.Type {
	case "RSA PRIVATE KEY":
		return x509.ParsePKCS1PrivateKey(block.Bytes)
	case "PRIVATE KEY":
		key, err := x509.ParsePKCS8PrivateKey(block.Bytes)
		if err != nil {
			return nil, err
		}
		rsaKey, ok := key.(*rsa.PrivateKey)
		if !ok {
			return nil, fmt.Errorf("PKCS8 key is not RSA")
		}
		return rsaKey, nil
	default:
		return nil, fmt.Errorf("unsupported PEM block type: %s", block.Type)
	}
}

// Kid returns the key ID used in JWT headers.
func (km *KeyManager) Kid() string {
	return km.kid
}

// Sign signs the given JWT claims using RS256 and includes the kid header.
func (km *KeyManager) Sign(claims jwt.Claims) (string, error) {
	tok := jwt.NewWithClaims(jwt.SigningMethodRS256, claims)
	tok.Header["kid"] = km.kid
	return tok.SignedString(km.privateKey)
}

// PublicKeyJWK returns the RSA public key as a JWK map.
func (km *KeyManager) PublicKeyJWK() map[string]interface{} {
	pub := &km.privateKey.PublicKey
	n := base64.RawURLEncoding.EncodeToString(pub.N.Bytes())
	e := base64.RawURLEncoding.EncodeToString(big.NewInt(int64(pub.E)).Bytes())
	return map[string]interface{}{
		"kty": "RSA",
		"use": "sig",
		"alg": "RS256",
		"kid": km.kid,
		"n":   n,
		"e":   e,
	}
}
