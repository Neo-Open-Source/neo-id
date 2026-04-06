// Feature: neo-id-oidc-refactor, Property 11: Инвариант количества сессий (не более 10)

package controllers

import (
	"testing"
	"time"

	"pgregory.net/rapid"
)

// inMemorySession represents a minimal session for in-memory simulation.
type inMemorySession struct {
	LastUsedAt time.Time
}

// simulateEnforceSessionLimit applies the enforceSessionLimit logic in-memory:
// before adding a new session, if len >= 10, remove the one with the minimum LastUsedAt.
func simulateEnforceSessionLimit(sessions []inMemorySession, newSession inMemorySession) []inMemorySession {
	if len(sessions) >= 10 {
		// Find index of oldest session (minimum LastUsedAt)
		oldestIdx := 0
		for i := 1; i < len(sessions); i++ {
			if sessions[i].LastUsedAt.Before(sessions[oldestIdx].LastUsedAt) {
				oldestIdx = i
			}
		}
		// Remove oldest
		sessions = append(sessions[:oldestIdx], sessions[oldestIdx+1:]...)
	}
	return append(sessions, newSession)
}

// TestPropertyP11_SessionLimit verifies that for any user, after creating N > 10 sessions
// using the enforceSessionLimit logic (simulated in-memory), the count must not exceed 10
// and the oldest session (by last_used_at) must have been removed.
//
// Validates: Requirements 11 (Инвариант количества сессий — не более 10)
func TestPropertyP11_SessionLimit(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		// Draw N in range [11, 30]
		n := rapid.IntRange(11, 30).Draw(t, "n")

		// Draw N random LastUsedAt offsets (seconds from a base time, unique to avoid ambiguity)
		baseTime := time.Date(2024, 1, 1, 0, 0, 0, 0, time.UTC)
		// Use distinct offsets so each session has a unique timestamp
		offsetSet := rapid.SliceOfNDistinct(
			rapid.IntRange(0, 100000),
			n, n,
			func(v int) int { return v },
		).Draw(t, "offsets")

		// Simulate adding N sessions with enforceSessionLimit logic.
		// Track which session (by its unique timestamp) was evicted at the moment
		// the slice first hit the limit (i.e., when the 11th session is added).
		var sessions []inMemorySession
		var evictedAt time.Time // timestamp of the session evicted on the first overflow

		for i := 0; i < n; i++ {
			newSession := inMemorySession{
				LastUsedAt: baseTime.Add(time.Duration(offsetSet[i]) * time.Second),
			}

			// Capture the oldest session right before the first eviction
			if len(sessions) == 10 && evictedAt.IsZero() {
				oldest := sessions[0].LastUsedAt
				for _, s := range sessions[1:] {
					if s.LastUsedAt.Before(oldest) {
						oldest = s.LastUsedAt
					}
				}
				evictedAt = oldest
			}

			sessions = simulateEnforceSessionLimit(sessions, newSession)
		}

		// Property 1: session count must not exceed 10
		if len(sessions) > 10 {
			t.Fatalf("session count %d exceeds limit of 10 after adding %d sessions", len(sessions), n)
		}

		// Property 2: the session evicted on first overflow must not appear in remaining sessions.
		// Because offsets are distinct, each timestamp is unique — so we can identify by time.
		if !evictedAt.IsZero() {
			for _, s := range sessions {
				if s.LastUsedAt.Equal(evictedAt) {
					t.Fatalf(
						"evicted session (LastUsedAt=%v) is still present in the session list",
						evictedAt,
					)
				}
			}
		}
	})
}
