import { Hono, type Context } from "hono";
import { corsMiddleware } from "./middleware/cors";
import { requestIdMiddleware } from "./middleware/request-id";
import { requireAuth } from "./middleware/auth";
import { rateLimit } from "./middleware/rate-limit";
import { startCleanup } from "./helpers/cleanup";

// Auth Routes
import { register } from "./routes/auth/register";
import { login } from "./routes/auth/login";
import { refresh } from "./routes/auth/refresh";
import { logout } from "./routes/auth/logout";
import { startSocialOAuth, socialOAuthCallback, completeSocialOAuth, startSocialOAuthLink } from "./routes/auth/oauth";
import { verifyEmail, verifyEmailByToken } from "./routes/auth/verify-email";

// User Routes
import { getProfile, updateProfile, checkUsername } from "./routes/user/profile";
import { changePassword } from "./routes/user/password";
import { uploadAvatar, deleteAvatar, setStockAvatar } from "./routes/user/avatar";
import { getAvatarImage } from "./routes/user/avatar-image";
import { deleteAccount, deleteChallenge, startDeletePasskey, sendDeleteCode } from "./routes/user/delete";
import { exportUserData, exportChallenge, startExportPasskey, sendExportCode } from "./routes/user/export";
import { listIdentities, disconnectIdentity } from "./routes/user/identities";
import { listConnections, revokeConnection } from "./routes/user/connections";
import { requestEmailChange, confirmEmailChange } from "./routes/user/email";

// MFA Routes
import { setupTotp, enableTotp, disableTotp } from "./routes/mfa/totp";
import { setupEmailMfa, enableEmailMfa, disableEmailMfa, resendLoginEmailMfa } from "./routes/mfa/email";
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
import { consent, consentInfo } from "./routes/oauth/consent";

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
import { uploadServiceLogo } from "./routes/services/logo";

// Admin Routes
import {
  listUsers,
  getUser,
  banUser,
  setRole,
  getStats,
  getAuditLogs,
  resetUserPassword,
  deleteUserAccount,
} from "./routes/admin/users";
import {
  listAllServices,
  setServiceActive,
  deleteAnyService,
  sendBroadcast,
} from "./routes/admin/services";
import { requireAdmin } from "./middleware/auth";

// Device Code Routes (RFC 8628)
import { requestDeviceCode } from "./routes/device/code";
import { pollDeviceToken } from "./routes/device/token";
import {
  getDeviceCodeInfo,
  approveDeviceCode,
  denyDeviceCode,
} from "./routes/device/verify";

// Password Reset
import { requestPasswordReset, resetPassword } from "./routes/auth/forgot-password";

const app = new Hono();

// ─── Global Middleware ────────────────────────────────────────────────────────

// Lazy-start cleanup on first incoming request (avoids DB access during build)
let cleanupStarted = false;
app.use("*", async (_, next) => {
  if (!cleanupStarted) {
    cleanupStarted = true;
    startCleanup();
  }
  await next();
});

app.use("*", corsMiddleware);
app.use("*", requestIdMiddleware);

// ─── Health ──────────────────────────────────────────────────────────────────

app.get("/health", (c) => c.json({ status: "ok", version: "4.0.0" }));

// ─── Auth Routes ─────────────────────────────────────────────────────────────

app.post("/api/v1/auth/register", rateLimit("REGISTER"), register);
app.post("/api/v1/auth/verify-email", rateLimit("EMAIL_VERIFY"), verifyEmail);
app.post("/api/v1/auth/verify-email/token", rateLimit("EMAIL_VERIFY"), verifyEmailByToken);
app.post("/api/v1/auth/login", rateLimit("LOGIN"), login);
app.post("/api/v1/auth/refresh", rateLimit("REFRESH"), refresh);
app.post("/api/v1/auth/logout", logout);

app.post("/api/v1/auth/forgot-password", rateLimit("FORGOT_PASSWORD"), requestPasswordReset);
app.post("/api/v1/auth/reset-password", rateLimit("RESET_PASSWORD"), resetPassword);

app.get("/api/v1/auth/oauth/:provider", startSocialOAuth);
app.post("/api/v1/auth/oauth/:provider/link", requireAuth, startSocialOAuthLink);
app.get("/api/v1/auth/oauth/:provider/callback", socialOAuthCallback);
app.post("/api/v1/auth/oauth/complete", completeSocialOAuth);

// ─── User Routes ─────────────────────────────────────────────────────────────

app.get("/api/v1/user/profile", requireAuth, getProfile);
app.put("/api/v1/user/profile", requireAuth, updateProfile);
app.get("/api/v1/user/username/check", requireAuth, checkUsername);
app.put("/api/v1/user/password", requireAuth, changePassword);
app.post("/api/v1/user/avatar", requireAuth, uploadAvatar);
app.put("/api/v1/user/avatar/stock", requireAuth, setStockAvatar);
app.get("/api/v1/user/avatar/image", requireAuth, getAvatarImage);
app.delete("/api/v1/user/avatar", requireAuth, deleteAvatar);
app.delete("/api/v1/user", requireAuth, deleteAccount);
app.post("/api/v1/user/delete/challenge", requireAuth, deleteChallenge);
app.post("/api/v1/user/delete/passkey/start", requireAuth, startDeletePasskey);
app.post("/api/v1/user/delete/send-code", requireAuth, sendDeleteCode);
app.post("/api/v1/user/export", requireAuth, exportUserData);
app.post("/api/v1/user/export/challenge", requireAuth, exportChallenge);
app.post("/api/v1/user/export/passkey/start", requireAuth, startExportPasskey);
app.post("/api/v1/user/export/send-code", requireAuth, sendExportCode);
app.post("/api/v1/user/email/change/request", requireAuth, requestEmailChange);
app.post("/api/v1/user/email/change/confirm", requireAuth, confirmEmailChange);
app.get("/api/v1/user/identities", requireAuth, listIdentities);
app.delete("/api/v1/user/identities/:provider", requireAuth, disconnectIdentity);
app.get("/api/v1/user/connections", requireAuth, listConnections);
app.delete("/api/v1/user/connections/:id", requireAuth, revokeConnection);

// ─── MFA Routes ──────────────────────────────────────────────────────────────

app.post("/api/v1/mfa/totp/setup", requireAuth, setupTotp);
app.post("/api/v1/mfa/totp/enable", requireAuth, enableTotp);
app.post("/api/v1/mfa/totp/disable", requireAuth, disableTotp);
app.post("/api/v1/mfa/email/setup", requireAuth, setupEmailMfa);
app.post("/api/v1/mfa/email/enable", requireAuth, enableEmailMfa);
app.post("/api/v1/mfa/email/disable", requireAuth, disableEmailMfa);
app.post("/api/v1/mfa/email/resend", resendLoginEmailMfa);
app.post("/api/v1/mfa/verify", rateLimit("MFA"), verifyMfa);

// ─── Passkey Routes ──────────────────────────────────────────────────────────

app.post("/api/v1/passkeys/register/start", requireAuth, startPasskeyRegistration);
app.post("/api/v1/passkeys/register/finish", requireAuth, finishPasskeyRegistration);
app.post("/api/v1/passkeys/authenticate/start", startPasskeyAuthentication);
app.post("/api/v1/passkeys/authenticate/finish", finishPasskeyAuthentication);
app.get("/api/v1/passkeys", requireAuth, listPasskeys);
app.delete("/api/v1/passkeys/:id", requireAuth, deletePasskey);

// ─── OAuth Routes ────────────────────────────────────────────────────────────

app.get("/api/v1/oauth/authorize", authorize);
app.post("/api/v1/oauth/token", token);
app.get("/api/v1/oauth/consent/:session", consentInfo);
app.post("/api/v1/oauth/consent", consent);
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
app.post("/api/v1/services/:id/logo", requireAuth, uploadServiceLogo);

// ─── Admin Routes ────────────────────────────────────────────────────────────

app.get("/api/v1/admin/users", requireAuth, requireAdmin, listUsers);
app.get("/api/v1/admin/users/:id", requireAuth, requireAdmin, getUser);
app.post("/api/v1/admin/users/:id/ban", requireAuth, requireAdmin, banUser);
app.post("/api/v1/admin/users/:id/role", requireAuth, requireAdmin, setRole);
app.post("/api/v1/admin/users/:id/reset-password", requireAuth, requireAdmin, resetUserPassword);
app.delete("/api/v1/admin/users/:id", requireAuth, requireAdmin, deleteUserAccount);
app.get("/api/v1/admin/stats", requireAuth, requireAdmin, getStats);
app.get("/api/v1/admin/audit", requireAuth, requireAdmin, getAuditLogs);
app.get("/api/v1/admin/services", requireAuth, requireAdmin, listAllServices);
app.post("/api/v1/admin/services/:id/active", requireAuth, requireAdmin, setServiceActive);
app.delete("/api/v1/admin/services/:id", requireAuth, requireAdmin, deleteAnyService);
app.post("/api/v1/admin/broadcast", requireAuth, requireAdmin, sendBroadcast);

// ─── Device Code Routes (RFC 8628 — TV/IoT/Console) ─────────────────────────

app.post("/api/v1/device/code", requestDeviceCode);
app.post("/api/v1/device/token", pollDeviceToken);
app.get("/api/v1/device/verify", getDeviceCodeInfo);
app.post("/api/v1/device/approve", requireAuth, approveDeviceCode);
app.post("/api/v1/device/deny", requireAuth, denyDeviceCode);

// ─── OIDC ────────────────────────────────────────────────────────────────────

function oidcConfig(c: Context) {
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
}

async function jwksHandler(c: Context) {
  const { getJwks } = await import("@neo-id/auth-core");
  const jwks = await getJwks();
  return c.json(jwks);
}

app.get("/.well-known/openid-configuration", oidcConfig);
app.get("/.well-known/jwks.json", jwksHandler);
app.get("/api/.well-known/openid-configuration", oidcConfig);
app.get("/api/.well-known/jwks.json", jwksHandler);

export default app;
