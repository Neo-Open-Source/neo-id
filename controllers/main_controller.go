package controllers

import (
	"io"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"strings"

	"github.com/beego/beego/v2/server/web"
)

type MainController struct {
	web.Controller
}

func serveStaticFile(c *web.Controller, candidates []string, contentType string) bool {
	for _, p := range candidates {
		if _, err := os.Stat(p); err == nil {
			if contentType != "" {
				c.Ctx.ResponseWriter.Header().Set("Content-Type", contentType)
			}
			http.ServeFile(c.Ctx.ResponseWriter, c.Ctx.Request, p)
			return true
		}
	}
	return false
}

func proxyFrontendDev(c *web.Controller) bool {
	frontendURL := os.Getenv("FRONTEND_DEV_URL")
	if frontendURL == "" {
		return false
	}

	target, err := url.Parse(frontendURL)
	if err != nil {
		return false
	}

	proxy := httputil.NewSingleHostReverseProxy(target)
	originalDirector := proxy.Director
	proxy.Director = func(req *http.Request) {
		originalDirector(req)
		req.Host = target.Host
	}
	proxy.ServeHTTP(c.Ctx.ResponseWriter, c.Ctx.Request)
	return true
}

// Get serves the main SPA index.html
func (c *MainController) Get() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	indexFile := "static/app/index.html"
	if _, err := os.Stat(indexFile); err != nil {
		// Try alternative path
		indexFile = "static/index.html"
		if _, err := os.Stat(indexFile); err != nil {
			respondError(&c.Controller, http.StatusNotFound, "not_found", "Frontend not built")
			return
		}
	}
	file, err := os.Open(indexFile)
	if err != nil {
		respondError(&c.Controller, http.StatusInternalServerError, "server_error", "Failed to serve index")
		return
	}
	defer file.Close()
	c.Ctx.ResponseWriter.Header().Set("Content-Type", "text/html; charset=utf-8")
	io.Copy(c.Ctx.ResponseWriter, file)
}

func (c *MainController) Scalar() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	if serveStaticFile(&c.Controller, []string{"static/app/scalar.html", "static/scalar.html"}, "text/html; charset=utf-8") {
		return
	}
	respondError(&c.Controller, http.StatusNotFound, "not_found", "Scalar docs not found")
}

func (c *MainController) OpenAPI() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	if serveStaticFile(&c.Controller, []string{"static/app/openapi.json", "static/openapi.json"}, "application/json; charset=utf-8") {
		return
	}
	respondError(&c.Controller, http.StatusNotFound, "not_found", "OpenAPI spec not found")
}

// Favicon serves the favicon.ico
func (c *MainController) Favicon() {
	if proxyFrontendDev(&c.Controller) {
		c.StopRun()
		return
	}

	paths := []string{"static/app/favicon.ico", "static/favicon.ico"}
	for _, p := range paths {
		if _, err := os.Stat(p); err == nil {
			c.Ctx.ResponseWriter.Header().Set("Content-Type", "image/x-icon")
			c.Ctx.ResponseWriter.Header().Set("Cache-Control", "public, max-age=86400")
			http.ServeFile(c.Ctx.ResponseWriter, c.Ctx.Request, p)
			return
		}
	}
	c.Ctx.ResponseWriter.WriteHeader(http.StatusNotFound)
}

// WidgetSDK serves embeddable JS SDK for QR/code auth widget.
// Usage:
// <script src="https://id.example.com/widget/sdk.js"></script>
// NeoIDWidget.mount("#el", { baseUrl: "https://id.example.com", onSuccess: ({ access_token, refresh_token }) => {} })
func (c *MainController) WidgetSDK() {
	baseURL := strings.TrimSpace(os.Getenv("BASE_URL"))
	if baseURL == "" {
		scheme := "https"
		if c.Ctx.Request.TLS == nil {
			scheme = "http"
		}
		baseURL = scheme + "://" + c.Ctx.Request.Host
	}
	baseURL = strings.TrimRight(baseURL, "/")

	js := `(function(global){
  function resolveContainer(target){
    if(!target) return null;
    if(typeof target === "string") return document.querySelector(target);
    if(target instanceof HTMLElement) return target;
    return null;
  }

  function mount(target, options){
    var container = resolveContainer(target);
    if(!container) throw new Error("NeoIDWidget: container not found");

    var opts = options || {};
    var baseUrl = (opts.baseUrl || "` + baseURL + `").replace(/\/+$/, "");
    var iframeUrl = baseUrl + "/widget/auth";

    var iframe = document.createElement("iframe");
    iframe.src = iframeUrl;
    iframe.style.width = opts.width || "420px";
    iframe.style.height = opts.height || "620px";
    iframe.style.border = "0";
    iframe.style.borderRadius = "16px";
    iframe.style.background = "transparent";
    iframe.setAttribute("allow", "clipboard-read; clipboard-write");
    iframe.setAttribute("loading", "lazy");

    container.innerHTML = "";
    container.appendChild(iframe);

    function onMessage(event){
      if(!event || !event.data) return;
      if(typeof event.data !== "object") return;
      if(event.data.type !== "neo_id_widget_auth") return;
      if(event.data.status !== "confirmed") return;

      // Strict origin check against configured base URL.
      try {
        var allowedOrigin = new URL(baseUrl).origin;
        if(event.origin !== allowedOrigin) return;
      } catch(e) {
        return;
      }

      if(typeof opts.onSuccess === "function"){
        opts.onSuccess({
          access_token: event.data.access_token || "",
          refresh_token: event.data.refresh_token || ""
        });
      }
    }

    window.addEventListener("message", onMessage);

    return {
      iframe: iframe,
      destroy: function(){
        window.removeEventListener("message", onMessage);
        if(iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }
    };
  }

  global.NeoIDWidget = { mount: mount };
})(window);`

	c.Ctx.ResponseWriter.Header().Set("Content-Type", "application/javascript; charset=utf-8")
	c.Ctx.ResponseWriter.Header().Set("Cache-Control", "public, max-age=300")
	_, _ = c.Ctx.ResponseWriter.Write([]byte(js))
}
