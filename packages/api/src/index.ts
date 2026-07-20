import { Hono } from "hono";
import { serve } from "@hono/node-server";
import { corsMiddleware } from "./middleware/cors";
import { requestIdMiddleware } from "./middleware/request-id";
import { requireAuth } from "./middleware/auth";

// Auth Routes
import { register } from "./routes/auth/register";
import { login } from "./routes/auth/login";
import { refresh } from "./routes/auth/refresh";
import { logout } from "./routes/auth/logout";

// User Routes
import { getProfile, updateProfile } from "./routes/user/profile";
import { changePassword } from "./routes/user/password";

// MFA Routes
import { setupTotp, enableTotp, disableTotp } from "./routes/mfa/totp";
import { setupEmailMfa, enableEmailMfa, disableEmailMfa } from "./routes/mfa/email";
import { verifyMfa } from "./routes/mfa/verify";

// Passkey Routes
import {
  startPasskeyRegistration,
  finishPasskeyRegistration,
} from "./routes/passkeys/register";
import {
  startPasskeyAuthentication,
  finishPasskeyAuthentication,
} from "./routes/passkeys/authenticate";
import { listPasskeys, deletePasskey } from "./routes/passkeys/list";

// OAuth Routes
import { authorize } from "./routes/oauth/authorize";
import { token } from "./routes/oauth/token";
import { userinfo } from "./routes/oauth/userinfo";

// Session Routes
import { listSessions, deleteSession, deleteAllSessions } from "./routes/sessions/list";

// Service Routes (Developer Portal)
import {
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  rotateSecret,
} from "./routes/services/list";

// Admin Routes
import {
  listUsers,
  getUser,
  banUser,
  setRole,
  getStats,
  getAuditLogs,
} from "./routes/admin/users";
import { requireAdmin } from "./middleware/auth";

// Setup Routes
import { setupCheck } from "./routes/setup/check";

const app = new Hono();

// ─── Global Middleware ────────────────────────────────────────────────────────

app.use("*", corsMiddleware);
app.use("*", requestIdMiddleware);

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", version: "4.0.0" }));

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.post("/api/v1/auth/register", register);
app.post("/api/v1/auth/login", login);
app.post("/api/v1/auth/refresh", refresh);
app.post("/api/v1/auth/logout", requireAuth, logout);

// ─── User Routes ─────────────────────────────────────────────────────────────

app.get("/api/v1/user/profile", requireAuth, getProfile);
app.put("/api/v1/user/profile", requireAuth, updateProfile);
app.put("/api/v1/user/password", requireAuth, changePassword);

// ─── MFA Routes ──────────────────────────────────────────────────────────────

// TOTP
app.post("/api/v1/mfa/totp/setup", requireAuth, setupTotp);
app.post("/api/v1/mfa/totp/enable", requireAuth, enableTotp);
app.post("/api/v1/mfa/totp/disable", requireAuth, disableTotp);

// Email MFA
app.post("/api/v1/mfa/email/setup", requireAuth, setupEmailMfa);
app.post("/api/v1/mfa/email/enable", requireAuth, enableEmailMfa);
app.post("/api/v1/mfa/email/disable", requireAuth, disableEmailMfa);

// MFA Verification (during login)
app.post("/api/v1/mfa/verify", verifyMfa);

// ─── Passkey Routes ──────────────────────────────────────────────────────────

// Registration
app.post("/api/v1/passkeys/register/start", requireAuth, startPasskeyRegistration);
app.post("/api/v1/passkeys/register/finish", requireAuth, finishPasskeyRegistration);

// Authentication (public — during login)
app.post("/api/v1/passkeys/authenticate/start", startPasskeyAuthentication);
app.post("/api/v1/passkeys/authenticate/finish", finishPasskeyAuthentication);

// Management
app.get("/api/v1/passkeys", requireAuth, listPasskeys);
app.delete("/api/v1/passkeys/:id", requireAuth, deletePasskey);

// ─── OAuth Routes ────────────────────────────────────────────────────────────

app.get("/api/v1/oauth/authorize", authorize);
app.post("/api/v1/oauth/token", token);
app.get("/api/v1/oauth/userinfo", requireAuth, userinfo);

// ─── Session Routes ──────────────────────────────────────────────────────────

app.get("/api/v1/sessions", requireAuth, listSessions);
app.delete("/api/v1/sessions/:id", requireAuth, deleteSession);
app.delete("/api/v1/sessions", requireAuth, deleteAllSessions);

// ─── Service Routes (Developer Portal) ───────────────────────────────────────

app.get("/api/v1/services", requireAuth, listServices);
app.get("/api/v1/services/:id", requireAuth, getService);
app.post("/api/v1/services", requireAuth, createService);
app.put("/api/v1/services/:id", requireAuth, updateService);
app.delete("/api/v1/services/:id", requireAuth, deleteService);
app.post("/api/v1/services/:id/rotate-secret", requireAuth, rotateSecret);

// ─── Admin Routes ────────────────────────────────────────────────────────────

app.get("/api/v1/admin/users", requireAuth, requireAdmin, listUsers);
app.get("/api/v1/admin/users/:id", requireAuth, requireAdmin, getUser);
app.post("/api/v1/admin/users/:id/ban", requireAuth, requireAdmin, banUser);
app.post("/api/v1/admin/users/:id/role", requireAuth, requireAdmin, setRole);
app.get("/api/v1/admin/stats", requireAuth, requireAdmin, getStats);
app.get("/api/v1/admin/audit", requireAuth, requireAdmin, getAuditLogs);

// ─── Setup Routes ────────────────────────────────────────────────────────────

app.get("/api/v1/setup/check", setupCheck);

// ─── OIDC ────────────────────────────────────────────────────────────────────

app.get("/.well-known/openid-configuration", (c) => {
  const issuer = process.env.JWT_ISSUER || "https://id.neome.uk";
  return c.json({
    issuer,
    authorization_endpoint: `${issuer}/api/v1/oauth/authorize`,
    token_endpoint: `${issuer}/api/v1/oauth/token`,
    userinfo_endpoint: `${issuer}/api/v1/oauth/userinfo`,
    jwks_uri: `${issuer}/.well-known/jwks.json`,
    response_types_supported: ["code"],
    subject_types_supported: ["public"],
    id_token_signing_alg_values_supported: ["RS256"],
    scopes_supported: ["openid", "profile", "email"],
    claims_supported: ["sub", "email", "name", "picture", "email_verified"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    code_challenge_methods_supported: ["S256"],
  });
});

app.get("/.well-known/jwks.json", async (c) => {
  const { getJwks } = await import("@neo-id/auth-core");
  const jwks = await getJwks();
  return c.json(jwks);
});

// ─── Start Server ────────────────────────────────────────────────────────────

const port = parseInt(process.env.API_PORT || "3000", 10);

console.log(`Neo ID API running on port ${port}`);

serve({
  fetch: app.fetch,
  port,
});
