package controllers_test

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"unified-id/controllers"

	beegoContext "github.com/beego/beego/v2/server/web/context"
)

func setupAuthController(t *testing.T, method, path string) (*controllers.AuthController, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	r := httptest.NewRequest(method, path, nil)
	ctx := beegoContext.NewContext()
	ctx.Reset(w, r)
	ctrl := &controllers.AuthController{}
	ctrl.Ctx = ctx
	ctrl.Data = make(map[interface{}]interface{})
	return ctrl, w
}

func setupOIDCController(t *testing.T, method, path string) (*controllers.OIDCController, *httptest.ResponseRecorder) {
	t.Helper()
	w := httptest.NewRecorder()
	r := httptest.NewRequest(method, path, nil)
	ctx := beegoContext.NewContext()
	ctx.Reset(w, r)
	ctrl := &controllers.OIDCController{}
	ctrl.Ctx = ctx
	ctrl.Data = make(map[interface{}]interface{})
	return ctrl, w
}

func TestSmokeHealthEndpoint(t *testing.T) {
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
	if status, ok := body["status"].(string); !ok || status != "ok" {
		t.Fatalf(`expected body["status"] == "ok", got %v`, body["status"])
	}
}

func TestSmokeServiceRegisterRoutePresence(t *testing.T) {
	routesPath := filepath.Join("..", "..", "routers", "routes.go")
	data, err := os.ReadFile(routesPath)
	if err != nil {
		t.Fatalf("failed to read routes.go: %v", err)
	}

	// Keep this aligned with current API behavior.
	if !strings.Contains(string(data), "/api/service/register") {
		t.Fatal("routes.go does not contain /api/service/register")
	}
}

func TestSmokeCORSHeadersInDiscovery(t *testing.T) {
	if controllers.GlobalKeyManager == nil {
		km, err := controllers.NewKeyManager()
		if err != nil {
			t.Fatalf("failed to initialize GlobalKeyManager: %v", err)
		}
		controllers.GlobalKeyManager = km
	}

	ctrl, w := setupOIDCController(t, http.MethodGet, "/.well-known/openid-configuration")
	ctrl.Discovery()

	resp := w.Result()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("expected status 200, got %d", resp.StatusCode)
	}
	if origin := resp.Header.Get("Access-Control-Allow-Origin"); origin != "*" {
		t.Fatalf(`expected Access-Control-Allow-Origin: *, got %q`, origin)
	}
}
