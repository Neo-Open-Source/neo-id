// Feature: neo-id-oidc-refactor, Property 1: Уникальность client_id при создании клиентов

package controllers

import (
	"testing"

	"pgregory.net/rapid"
)

// TestPropertyP1_ClientIDUniqueness verifies that for any N calls to generateSiteID(),
// all returned values are pairwise unique.
//
// Validates: Requirements 1.1 (уникальность client_id)
func TestPropertyP1_ClientIDUniqueness(t *testing.T) {
	// rapid.Check runs 100 times by default (controlled via -rapid.checks flag, default=100)
	rapid.Check(t, func(t *rapid.T) {
		n := rapid.IntRange(2, 50).Draw(t, "n")

		seen := make(map[string]struct{}, n)
		for i := 0; i < n; i++ {
			id := generateSiteID()
			if _, exists := seen[id]; exists {
				t.Fatalf("duplicate client_id generated: %s (after %d calls)", id, i+1)
			}
			seen[id] = struct{}{}
		}
	})
}
