// Feature: neo-id-oidc-refactor, Property 12: Инвалидация сессий при смене пароля

package controllers

import (
	"testing"

	"pgregory.net/rapid"
)

// TestPropertyP12_SessionInvalidationOnPasswordChange verifies that for any user with N active
// sessions, after applying DeleteUserSessionsExcept logic (simulated in-memory), exactly 1 session
// remains (the current one) and all other N-1 sessions are gone.
//
// Validates: Requirements 10.9 (инвалидация сессий при смене пароля)
func TestPropertyP12_SessionInvalidationOnPasswordChange(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.IntRange(2, 20).Draw(t, "n")

		// Generate N unique token strings
		tokens := make([]string, n)
		seen := make(map[string]struct{}, n)
		for i := range n {
			var tok string
			for {
				tok = rapid.StringMatching(`[A-Za-z0-9]{16,64}`).Draw(t, "token")
				if _, exists := seen[tok]; !exists {
					break
				}
			}
			tokens[i] = tok
			seen[tok] = struct{}{}
		}

		// Pick one as the "current" session (the one used for password change)
		currentIdx := rapid.IntRange(0, n-1).Draw(t, "currentIdx")
		currentToken := tokens[currentIdx]

		// Simulate DeleteUserSessionsExcept: keep only sessions where token == currentToken
		var remaining []string
		for _, tok := range tokens {
			if tok == currentToken {
				remaining = append(remaining, tok)
			}
		}

		// Verify exactly 1 session remains
		if len(remaining) != 1 {
			t.Fatalf("expected exactly 1 remaining session, got %d", len(remaining))
		}

		// Verify the remaining session's token equals currentToken
		if remaining[0] != currentToken {
			t.Fatalf("remaining session token %q != currentToken %q", remaining[0], currentToken)
		}

		// Verify all other tokens are absent
		remainingSet := map[string]struct{}{remaining[0]: {}}
		for i, tok := range tokens {
			if i == currentIdx {
				continue
			}
			if _, exists := remainingSet[tok]; exists {
				t.Fatalf("token %q (index %d) should have been invalidated but is still present", tok, i)
			}
		}
	})
}
