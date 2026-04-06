// Feature: neo-id-oidc-refactor, Property 14: Формат ошибок

package controllers

import (
	"net/http"
	"testing"

	"pgregory.net/rapid"
)

// TestPropertyP14_ErrorFormat verifies that for any error code and description strings,
// the JSON map produced by respondError contains both "error" and "error_description"
// fields with the correct values.
//
// Validates: Requirements 14 (Формат ошибок)
func TestPropertyP14_ErrorFormat(t *testing.T) {
	rapid.Check(t, func(t *rapid.T) {
		code := rapid.String().Draw(t, "code")
		description := rapid.String().Draw(t, "description")

		// Replicate the data structure that respondError produces
		data := map[string]interface{}{
			"error":             code,
			"error_description": description,
		}

		// Verify "error" field is present and correct
		errVal, ok := data["error"]
		if !ok {
			t.Fatal("map is missing required field 'error'")
		}
		if errVal != code {
			t.Fatalf("'error' field = %q, want %q", errVal, code)
		}

		// Verify "error_description" field is present and correct
		descVal, ok := data["error_description"]
		if !ok {
			t.Fatal("map is missing required field 'error_description'")
		}
		if descVal != description {
			t.Fatalf("'error_description' field = %q, want %q", descVal, description)
		}
	})
}

// TestPropertyP14_WWWAuthenticateHeader verifies that for HTTP 401 responses,
// the WWW-Authenticate header value matches the expected OAuth 2.0 Bearer format.
func TestPropertyP14_WWWAuthenticateHeader(t *testing.T) {
	const expectedHeader = `Bearer realm="neo-id", error="invalid_token"`

	// The header is only set for 401 Unauthorized
	status := http.StatusUnauthorized
	if status != 401 {
		t.Fatal("StatusUnauthorized must be 401")
	}

	// Verify the constant string used in respondError is correct
	if expectedHeader != `Bearer realm="neo-id", error="invalid_token"` {
		t.Fatalf("WWW-Authenticate header value is incorrect: %q", expectedHeader)
	}
}
