package controllers

import (
	"crypto/sha256"
	"encoding/base64"
	"testing"
)

func TestVerifyCodeChallenge(t *testing.T) {
	// Helper to compute S256 challenge from verifier
	s256 := func(verifier string) string {
		h := sha256.Sum256([]byte(verifier))
		return base64.RawURLEncoding.EncodeToString(h[:])
	}

	tests := []struct {
		name      string
		verifier  string
		challenge string
		method    string
		want      bool
	}{
		{
			name:      "S256 valid",
			verifier:  "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
			challenge: s256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
			method:    "S256",
			want:      true,
		},
		{
			name:      "S256 wrong verifier",
			verifier:  "wrongverifier",
			challenge: s256("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
			method:    "S256",
			want:      false,
		},
		{
			name:      "S256 lowercase method",
			verifier:  "myverifier",
			challenge: s256("myverifier"),
			method:    "s256",
			want:      true,
		},
		{
			name:      "plain valid",
			verifier:  "mysecretverifier",
			challenge: "mysecretverifier",
			method:    "plain",
			want:      true,
		},
		{
			name:      "plain empty method string",
			verifier:  "mysecretverifier",
			challenge: "mysecretverifier",
			method:    "",
			want:      true,
		},
		{
			name:      "plain wrong verifier",
			verifier:  "wrongverifier",
			challenge: "mysecretverifier",
			method:    "plain",
			want:      false,
		},
		{
			name:      "unknown method",
			verifier:  "anything",
			challenge: "anything",
			method:    "RS256",
			want:      false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := verifyCodeChallenge(tt.verifier, tt.challenge, tt.method)
			if got != tt.want {
				t.Errorf("verifyCodeChallenge(%q, %q, %q) = %v, want %v",
					tt.verifier, tt.challenge, tt.method, got, tt.want)
			}
		})
	}
}
