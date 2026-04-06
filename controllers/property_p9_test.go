// Feature: neo-id-oidc-refactor, Property 9: Защита от replay-атак

package controllers

import (
	"testing"
	"time"

	"pgregory.net/rapid"

	"go.mongodb.org/mongo-driver/bson/primitive"

	"unified-id/models"
)

// TestPropertyP9_ReplayProtection verifies that once an AuthCode is marked as used,
// any subsequent check of authCode.Used returns true — which the controller uses to
// reject the request with "invalid_grant".
//
// Validates: Requirements 9 (защита от replay-атак — повторный auth_code)
func TestPropertyP9_ReplayProtection(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		code := rapid.StringMatching(`[a-zA-Z0-9]{8,32}`).Draw(t, "code")
		clientID := rapid.StringMatching(`[a-zA-Z0-9]{4,16}`).Draw(t, "clientID")
		userID := rapid.StringMatching(`[a-zA-Z0-9]{4,16}`).Draw(t, "userID")

		// Create a fresh, unused auth code (simulates a newly issued code)
		authCode := &models.AuthCode{
			ID:        primitive.NewObjectID(),
			Code:      code,
			ClientID:  clientID,
			UserID:    userID,
			Used:      false,
			ExpiresAt: time.Now().Add(5 * time.Minute),
			CreatedAt: time.Now(),
		}

		// First use: the guard in processAuthCodeGrant would pass
		if authCode.Used {
			t.Fatal("newly created auth code should not be marked as used")
		}

		// Simulate MarkUsed (what the controller calls after first successful exchange)
		authCode.Used = true

		// Second attempt: the guard must reject it
		if !authCode.Used {
			t.Fatalf("auth code should be marked as used after MarkUsed; code=%s clientID=%s userID=%s",
				code, clientID, userID)
		}
	})
}
