use auth_core::{AuthError, CredentialId, register_response};
use auth_db::{Executor, Kv as _};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand_chacha::{ChaCha8Rng, rand_core::SeedableRng};
use rsa::{RsaPublicKey, pkcs8::DecodePublicKey, traits::PublicKeyParts};
use worker::{Env, Request, Response, Result, RouteContext, Router};

use crate::{
    env::{AppEnv, load},
    neon::NeonExecutor,
    respond::{fail, ok},
};

pub(crate) struct Ctx {
    pub(crate) request_id: String,
    pub(crate) now_ms: u64,
    pub(crate) now: u64,
    pub(crate) app: AppEnv,
    pub(crate) db: NeonExecutor,
}

pub(crate) fn load_cx(env: &Env) -> std::result::Result<Ctx, AuthError> {
    let app = load(env)?;
    let endpoint = app.endpoint.clone();
    let connection = env
        .var("DATABASE_URL")
        .map_err(|_| AuthError::Internal)?
        .to_string();
    let now_ms = worker::Date::now().as_millis();
    let mut rng = worker_rng()?;
    Ok(Ctx {
        request_id: auth_core::generate_id(&mut rng),
        now_ms,
        now: now_ms / 1000,
        app,
        db: NeonExecutor::new(endpoint, connection),
    })
}

async fn health(_req: Request, ctx: RouteContext<()>) -> Result<Response> {
    match load_cx(&ctx.env) {
        Ok(cx) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"status": "ok"}),
            200,
        ),
        Err(_) => Response::error("Internal", 500),
    }
}

async fn discovery(_req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let issuer = cx.app.issuer.clone();
    ok(
        &cx.request_id,
        cx.now_ms,
        &serde_json::json!({
            "issuer": issuer,
            "authorization_endpoint": format!("{issuer}/api/v1/oauth2/authorize"),
            "token_endpoint": format!("{issuer}/api/v1/oauth2/token"),
            "userinfo_endpoint": format!("{issuer}/api/v1/oauth2/userinfo"),
            "jwks_uri": format!("{issuer}/.well-known/jwks.json"),
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "subject_types_supported": ["public"],
            "id_token_signing_alg_values_supported": ["RS256"],
            "scopes_supported": ["openid", "profile", "email"],
            "token_endpoint_auth_methods_supported": ["client_secret_basic", "client_secret_post", "none"],
        }),
        200,
    )
}

fn rsa_jwk(public_pem: &[u8]) -> Result<serde_json::Value, AuthError> {
    let text = String::from_utf8(public_pem.to_vec()).map_err(|_| AuthError::Internal)?;
    let key = RsaPublicKey::from_public_key_pem(&text).map_err(|_| AuthError::Internal)?;
    Ok(serde_json::json!({
        "kty": "RSA",
        "n": URL_SAFE_NO_PAD.encode(key.n().to_bytes_be()),
        "e": URL_SAFE_NO_PAD.encode(key.e().to_bytes_be()),
        "alg": "RS256",
        "use": "sig",
    }))
}

async fn jwks(_req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    match rsa_jwk(&cx.app.public_pem) {
        Ok(key) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"keys": [key]}),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

async fn register_start(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let email = body
        .get("email")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let request_b64 = body
        .get("request")
        .and_then(|value| value.as_str())
        .unwrap_or_default();
    let (user_id, status) = match auth_accounts::check_email(&cx.db, email).await {
        Ok(auth_accounts::Availability::Fresh) => match create_user(&cx.db, email).await {
            Ok(id) => (id, "fresh"),
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        },
        Ok(auth_accounts::Availability::Resume(id)) => (id, "resumed"),
        Ok(auth_accounts::Availability::Taken) => {
            return fail_status(
                &cx,
                409,
                "EMAIL_ALREADY_EXISTS",
                "Email is already registered",
            );
        }
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(request_bytes) = URL_SAFE_NO_PAD.decode(request_b64) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    let credential = match CredentialId::try_from(user_id.as_bytes()) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match register_response(&cx.app.setup, &request_bytes, credential) {
        Ok(response) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({
                "status": status,
                "user_id": user_id,
                "response": URL_SAFE_NO_PAD.encode(response),
            }),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

async fn create_user<E: Executor>(db: &E, email: &str) -> Result<String, AuthError> {
    let rows = db.run(auth_db::create_user(email)).await?;
    rows.first()
        .and_then(|row| row.get("id"))
        .and_then(serde_json::Value::as_str)
        .map(String::from)
        .ok_or(AuthError::Internal)
}

fn fail_status(cx: &Ctx, status: u16, code: &str, message: &str) -> Result<Response> {
    Response::from_json(&serde_json::json!({
        "ok": false,
        "error": {"code": code, "message": message, "status": status},
        "meta": {"request_id": cx.request_id, "timestamp": cx.now_ms},
    }))
    .map(|response| response.with_status(status))
}

fn body_field<'a>(body: &'a serde_json::Value, key: &str) -> &'a str {
    body.get(key)
        .and_then(|value| value.as_str())
        .unwrap_or_default()
}

fn cookie_value(req: &Request, name: &str) -> Option<String> {
    req.headers()
        .get("cookie")
        .ok()
        .flatten()?
        .split(';')
        .filter_map(|pair| pair.trim().split_once('='))
        .find(|(key, _)| key.trim() == name)
        .map(|(_, value)| value.trim().to_string())
}

fn kv_store(ctx: &RouteContext<()>) -> Result<worker::kv::KvStore, AuthError> {
    ctx.env.kv("STATES").map_err(|_| AuthError::Internal)
}

async fn register_finish(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let Ok(upload) = URL_SAFE_NO_PAD.decode(body_field(&body, "upload")) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    match auth_accounts::finish_registration(&cx.db, body_field(&body, "user_id"), &upload).await {
        Ok(()) => ok(&cx.request_id, cx.now_ms, &serde_json::json!({}), 200),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

async fn login_start(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return fail("unknown", 0, &AuthError::Internal),
    };
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let Ok(request_bytes) = URL_SAFE_NO_PAD.decode(body_field(&body, "request")) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::start_login(
        &cx.db,
        &cx.app.setup,
        &mut rng,
        body_field(&body, "email"),
        &request_bytes,
    )
    .await
    {
        Ok(challenge) => {
            let state_id = cx.request_id.clone();
            if store
                .put(&state_key(&state_id), &challenge.state, 300)
                .await
                .is_err()
            {
                return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
            }
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({
                    "state_id": state_id,
                    "response": URL_SAFE_NO_PAD.encode(challenge.response),
                }),
                200,
            )
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

fn state_key(state_id: &str) -> String {
    format!("login:{state_id}")
}

pub(crate) fn header_opt(req: &Request, name: &str) -> Option<String> {
    req.headers()
        .get(name)
        .ok()
        .flatten()
        .as_deref()
        .map(String::from)
}

struct VerifiedUser {
    id: String,
    email: String,
    role: String,
    methods: Vec<&'static str>,
    passkeys: usize,
    email_mfa: bool,
}

async fn verified_user<E: auth_db::Executor>(
    db: &E,
    email: &str,
) -> Result<Option<VerifiedUser>, AuthError> {
    let users = db.run(auth_db::find_user_by_email(email)).await?;
    let Some(user) = users.first() else {
        return Ok(None);
    };
    let id = user
        .get("id")
        .and_then(|value| value.as_str())
        .unwrap_or_default()
        .to_string();
    let passkeys = db.run(auth_db::passkeys_by_user(&id)).await?.len();
    let flag = |key: &str| {
        user.get(key)
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false)
    };
    let mut methods = Vec::new();
    if passkeys > 0 {
        methods.push("passkey");
    }
    if flag("totpEnabled") {
        methods.push("totp");
    }
    if flag("emailMfaEnabled") {
        methods.push("email");
    }
    Ok(Some(VerifiedUser {
        id,
        email: user
            .get("email")
            .and_then(|value| value.as_str())
            .unwrap_or_default()
            .to_string(),
        role: user
            .get("role")
            .and_then(|value| value.as_str())
            .unwrap_or("user")
            .to_string(),
        methods,
        passkeys,
        email_mfa: flag("emailMfaEnabled"),
    }))
}

async fn login_finish(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return fail("unknown", 0, &AuthError::Internal),
    };
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let state_id = body_field(&body, "state_id");
    let state_bytes = match store.get(&state_key(state_id)).await {
        Ok(Some(bytes)) => bytes,
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let _ = store.delete(&state_key(state_id)).await;
    let Ok(final_bytes) = URL_SAFE_NO_PAD.decode(body_field(&body, "finalization")) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    let state = match auth_core::LoginState::from_bytes(state_bytes) {
        Ok(state) => state,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let session_key = match auth_core::login_finish(state, &final_bytes) {
        Ok(key) => key,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    drop(session_key);
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let email = body_field(&body, "email");
    let verified = match verified_user(&cx.db, email).await {
        Ok(Some(verified)) => verified,
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    if !verified.methods.is_empty() {
        return ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({
                "mfaRequired": true,
                "mfaMethods": verified.methods,
                "passkeyAvailable": verified.passkeys > 0,
                "emailHint": verified.email_mfa.then_some(verified.email.clone()),
                "user": {"id": verified.id, "email": verified.email, "role": verified.role},
            }),
            200,
        );
    }
    let device = header_opt(&req, "user-agent");
    let ip = header_opt(&req, "cf-connecting-ip");
    let params = auth_accounts::MintParams {
        private_pem: &cx.app.private_pem,
        issuer: &cx.app.issuer,
        device: device.as_deref(),
        ip: ip.as_deref(),
        audience: None,
    };
    let login_user = auth_accounts::LoginUser {
        id: verified.id.clone(),
        email: verified.email.clone(),
        role: verified.role.clone(),
    };
    match auth_accounts::complete_login(&cx.db, &mut rng, cx.now, &params, &login_user).await {
        Ok(tokens) => crate::respond::with_cookies(
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({
                    "accessToken": tokens.access_token,
                    "refreshToken": tokens.refresh_token,
                    "idToken": tokens.id_token,
                    "user": {"id": login_user.id, "email": login_user.email, "role": login_user.role},
                }),
                200,
            ),
            &tokens.access_token,
            &tokens.refresh_token,
            auth_core::REFRESH_EXPIRY,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub(crate) fn worker_rng() -> Result<ChaCha8Rng, AuthError> {
    let mut seed = [0u8; 32];
    getrandom::fill(&mut seed).map_err(|_| AuthError::Internal)?;
    Ok(ChaCha8Rng::from_seed(seed))
}

async fn refresh_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = req.json().await.unwrap_or(serde_json::Value::Null);
    let presented = body_field(&body, "refresh_token").to_string();
    let presented = if presented.is_empty() {
        match cookie_value(&req, "neo_id_refresh") {
            Some(value) => value,
            None => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        }
    } else {
        presented
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let device = header_opt(&req, "user-agent");
    let ip = header_opt(&req, "cf-connecting-ip");
    let params = auth_accounts::MintParams {
        private_pem: &cx.app.private_pem,
        issuer: &cx.app.issuer,
        device: device.as_deref(),
        ip: ip.as_deref(),
        audience: None,
    };
    match auth_accounts::rotate_refresh(&cx.db, &mut rng, cx.now, &params, &presented).await {
        Ok(rotation) => crate::respond::with_cookies(
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({
                    "accessToken": rotation.minted.access_token,
                    "refreshToken": rotation.minted.refresh_token,
                    "idToken": rotation.minted.id_token,
                    "user": {"id": rotation.user.id, "email": rotation.user.email, "role": rotation.user.role},
                }),
                200,
            ),
            &rotation.minted.access_token,
            &rotation.minted.refresh_token,
            auth_core::REFRESH_EXPIRY,
        ),
        Err(auth_accounts::Failure::Auth(err)) => fail(&cx.request_id, cx.now_ms, &err),
        Err(auth_accounts::Failure::Code(code)) => fail_status(&cx, 401, code, "Refresh rejected"),
    }
}

async fn logout_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = req.json().await.unwrap_or(serde_json::Value::Null);
    let presented = body_field(&body, "access_token").to_string();
    let presented = if presented.is_empty() {
        cookie_value(&req, "neo_id_access").unwrap_or_default()
    } else {
        presented
    };
    if !presented.is_empty() {
        if let Ok(claims) =
            auth_core::verify_access(&cx.app.public_pem, &presented, &cx.app.issuer, cx.now)
        {
            if let Some(session_id) = claims.session_id {
                let _ = auth_accounts::end_session(&cx.db, &session_id, cx.now).await;
            }
        }
    }
    crate::respond::cleared_cookies(ok(&cx.request_id, cx.now_ms, &serde_json::json!({}), 200))
}

pub fn router() -> Router<'static, ()> {
    Router::new()
        .get_async("/health", health)
        .get_async("/.well-known/openid-configuration", discovery)
        .get_async("/.well-known/jwks.json", jwks)
        .post_async("/api/v1/auth/register/start", register_start)
        .post_async("/api/v1/auth/register/finish", register_finish)
        .post_async("/api/v1/auth/login/start", login_start)
        .post_async("/api/v1/auth/login/finish", login_finish)
        .post_async("/api/v1/auth/refresh", refresh_route)
        .post_async("/api/v1/auth/logout", logout_route)
        .get_async("/api/v1/oauth2/authorize", crate::oidc::authorize_route)
        .post_async(
            "/api/v1/oauth2/authorize/consent",
            crate::oidc::consent_route,
        )
        .post_async("/api/v1/oauth2/token", crate::oidc::token_route)
        .get_async("/api/v1/oauth2/userinfo", crate::oidc::userinfo_route)
        .post_async("/api/v1/oauth2/logout", crate::oidc::logout_route)
        .post_async("/api/v1/oauth2/register", crate::oidc::register_route)
}
