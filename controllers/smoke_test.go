// Smoke tests for neo-id-oidc-refactor
// Tests: /api/health, CORS headers, POST /api/service/register → 404

package controllers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	beegoContext "github.com/beego/beego/v2/server/web/context"
)

// setupAuthController creates an AuthController with a minimal Beego context.
func setupAuthController(t *testing.T, method, path string) (*AuthController, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	r := httptest.NewRequest(method, path, nil)
	ctx := beegoContext.NewContext()
	ctx.Reset(w, r)
	ctrl := &AuthController{}
	ctrl.Ctx = ctx
	ctrl.Data = make(map[interface{}]interface{})
	return ctrl, w
}

// setupOIDCController creates an OIDCController with a minimal Beego context.
func setupOIDCController(t *testing.T, method, path string) (*OIDCController, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	r := httptest.NewRequest(method, path, nil)
	ctx := beegoContext.NewContext()
	ctx.Reset(w, r)
	ctrl := &OIDCController{}
	ctrl.Ctx = ctx
	ctrl.Data = make(map[interface{}]interface{})
	return ctrl, w
}

// TestSmoke_HealthEndpoint verifies that the Health handler returns 200 with {"status":"ok"}.
func TestSmoke_HealthEndpoint(t *testing.T) {
	ctrl, w := setupAuthController(t, http.MethodGet, "/api/health")
	ctrl.Health()

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	var body map[string]interface{}
	if err := json.NewDecoder(w.Body).Decode(&body); err != nil {
		t.Fatalf("failed to decode response body: %v", err)
	}

	status, ok := body["status"].(string)
	if !ok || status != "ok" {
		t.Fatalf(`expected body["status"] == "ok", got %v`, body["status"])
	}
}

// TestSmoke_ServiceRegisterRemoved verifies that POST /api/service/register is NOT registered.
// It reads routes.go and asserts the path is absent.
func TestSmoke_ServiceRegisterRemoved(t *testing.T) {
	data, err := os.ReadFile("../routers/routes.go")
	if err != nil {
		t.Fatalf("failed to read routes.go: %v", err)
	}

	if strings.Contains(string(data), "/api/service/register") {
		t.Fatal("routes.go still contains /api/service/register — route should have been removed")
	}
}

// TestSmoke_CORSHeadersInDiscovery verifies that the Discovery handler sets Access-Control-Allow-Origin: *.
func TestSmoke_CORSHeadersInDiscovery(t *testing.T) {
	// Ensure GlobalKeyManager is initialized (reuses init() from property_p6p7_test.go)
	if GlobalKeyManager == nil {
		km, err := NewKeyManager()
		if err != nil {
			t.Fatalf("failed to initialize GlobalKeyManager: %v", err)
		}
		GlobalKeyManager = km
	}

	ctrl, w := setupOIDCController(t, http.MethodGet, "/.well-known/openid-configuration")
	ctrl.Discovery()

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}

	origin := resp.Header.Get("Access-Control-Allow-Origin")
	if origin != "*" {
		t.Fatalf(`expected Access-Control-Allow-Origin: *, got %q`, origin)
	}
}
