package controllers

import (
	"github.com/golang-jwt/jwt/v5"
)

// Claims represents JWT claims structure
type Claims struct {
	UnifiedID string `json:"unified_id"`
	Email     string `json:"email"`
	jwt.RegisteredClaims
}
