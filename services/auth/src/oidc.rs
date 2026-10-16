use std::fmt::Write as _;

use auth_core::{AuthError, verify_access};
use auth_oidc::{
    AuthorizeRequest, ConsentChoice, ConsentRequest, Grant, LogoutRequest, RegisterRequest,
    TokenRequest, UserInfoRequest, WireError, authorize, decide_consent, logout, register, token,
    userinfo,
};
use worker::{Request, Response, Result, RouteContext};

use super::{
    respond::{fail, ok},
    routes::{Ctx, header_opt, load_cx, worker_rng},
};

fn oauth_error(cx: &Ctx, err: WireError) -> Result<Response> {
    let (status, code) = match err {
        WireError::InvalidClient => (401, err.as_str()),
        WireError::ServerError => (500, err.as_str()),
        _ => (400, err.as_str()),
    };
    Response::from_json(&serde_json::json!({"error": code}))
        .map(|response| response.with_status(status))
        .or_else(|_| fail(&cx.request_id, cx.now_ms, &AuthError::Internal))
}

fn logged_user(cx: &Ctx, req: &Request) -> Option<(String, Option<String>)> {
    let header = header_opt(req, "authorization")?;
    let presented = header.strip_prefix("Bearer ")?;
    let claims = verify_access(&cx.app.public_pem, presented, &cx.app.issuer, cx.now).ok()?;
    Some((claims.sub, claims.session_id))
}

fn query_pairs(url: &url::Url) -> std::collections::HashMap<String, String> {
    url.query_pairs().into_owned().collect()
}

fn some_query(params: &std::collections::HashMap<String, String>, key: &str) -> Option<String> {
    params.get(key).filter(|value| !value.is_empty()).cloned()
}

fn encode_redirect(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                let _ = write!(out, "%{byte:02X}");
            }
        }
    }
    out
}

pub async fn authorize_route(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let Ok(url) = req.url() else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    let params = query_pairs(&url);
    let required = |key: &str| params.get(key).cloned().unwrap_or_default();
    let user = logged_user(&cx, &req);
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match authorize(
        &cx.db,
        &mut rng,
        cx.now,
        AuthorizeRequest {
            response_type: required("response_type"),
            client_id: required("client_id"),
            redirect_uri: required("redirect_uri"),
            state: some_query(&params, "state"),
            code_challenge: some_query(&params, "code_challenge"),
            code_challenge_method: some_query(&params, "code_challenge_method"),
            user_id: user.as_ref().map(|(sub, _)| sub.clone()),
            session_id: user.as_ref().and_then(|(_, session)| session.clone()),
            login_url: format!("/auth?redirect={}", encode_redirect(url.as_str())),
        },
    )
    .await
    {
        Ok(auth_oidc::AuthorizeOutcome::Login { url }) => match url::Url::parse(&url) {
            Ok(target) => Response::redirect(target),
            Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
        },
        Ok(auth_oidc::AuthorizeOutcome::Consent {
            state,
            redirect_uri,
            scopes,
        }) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({
                "consent_required": true,
                "state": state,
                "redirect_uri": redirect_uri,
                "scopes": scopes,
            }),
            200,
        ),
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn consent_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let Some(user) = logged_user(&cx, &req) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials);
    };
    let approved = body
        .get("approved")
        .and_then(serde_json::Value::as_bool)
        .unwrap_or(false);
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let field = |key: &str| {
        body.get(key)
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    let optional = |key: &str| {
        let value = field(key);
        if value.is_empty() { None } else { Some(value) }
    };
    match decide_consent(
        &cx.db,
        &mut rng,
        cx.now,
        ConsentRequest {
            choice: if approved {
                ConsentChoice::Approved
            } else {
                ConsentChoice::Denied
            },
            service_app_id: field("service_app_id"),
            user_id: user.0.clone(),
            session_id: user.1.clone(),
            redirect_uri: field("redirect_uri"),
            state: optional("state"),
            code_challenge: optional("code_challenge"),
        },
    )
    .await
    {
        Ok(redirect) => match url::Url::parse(&redirect.url) {
            Ok(target) => Response::redirect(target),
            Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
        },
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn token_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let field = |key: &str| {
        body.get(key)
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    let optional = |key: &str| {
        let value = field(key);
        if value.is_empty() { None } else { Some(value) }
    };
    let grant = match field("grant_type").as_str() {
        "authorization_code" => Grant::Code {
            code: field("code"),
            redirect_uri: field("redirect_uri"),
            client_id: field("client_id"),
            client_secret: optional("client_secret"),
            code_verifier: optional("code_verifier"),
        },
        "refresh_token" => Grant::Refresh {
            refresh_token: field("refresh_token"),
            client_id: field("client_id"),
        },
        _ => return oauth_error(&cx, WireError::UnsupportedGrantType),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match token(
        &cx.db,
        &mut rng,
        cx.now,
        &cx.app.private_pem,
        &cx.app.issuer,
        TokenRequest {
            grant,
            device: header_opt(&req, "user-agent"),
            ip: header_opt(&req, "cf-connecting-ip"),
        },
    )
    .await
    {
        Ok(tokens) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({
                "access_token": tokens.access_token,
                "token_type": "Bearer",
                "expires_in": tokens.expires_in,
                "refresh_token": tokens.refresh_token,
                "id_token": tokens.id_token,
            }),
            200,
        ),
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn userinfo_route(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let Some(header) = header_opt(&req, "authorization") else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials);
    };
    let Some(presented) = header.strip_prefix("Bearer ") else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    let claims = match verify_access(&cx.app.public_pem, presented, &cx.app.issuer, cx.now) {
        Ok(claims) => claims,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match userinfo(
        &cx.db,
        &mut rng,
        cx.now,
        UserInfoRequest { sub: claims.sub },
    )
    .await
    {
        Ok(info) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({
                "sub": info.sub,
                "email": info.email,
                "email_verified": info.email_verified,
                "name": info.name,
                "given_name": info.given_name,
                "family_name": info.family_name,
                "picture": info.picture,
            }),
            200,
        ),
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn logout_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = req.json().await.unwrap_or(serde_json::Value::Null);
    let field = |key: &str| {
        body.get(key)
            .and_then(serde_json::Value::as_str)
            .unwrap_or_default()
            .to_string()
    };
    let optional = |key: &str| {
        let value = field(key);
        if value.is_empty() { None } else { Some(value) }
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match logout(
        &cx.db,
        &mut rng,
        cx.now,
        LogoutRequest {
            session_id: optional("session_id"),
            user_id: optional("user_id"),
            post_logout_redirect: optional("post_logout_redirect_uri"),
        },
    )
    .await
    {
        Ok(done) => match url::Url::parse(&done.redirect_url) {
            Ok(target) => Response::redirect(target),
            Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
        },
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn register_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match req.json().await {
        Ok(body) => body,
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
    };
    let redirect_uris = body
        .get("redirect_uris")
        .and_then(|value| value.as_array())
        .map(|items| {
            items
                .iter()
                .filter_map(serde_json::Value::as_str)
                .map(String::from)
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();
    let client_name = body
        .get("client_name")
        .and_then(serde_json::Value::as_str)
        .map(String::from);
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match register(
        &cx.db,
        &mut rng,
        cx.now,
        RegisterRequest {
            redirect_uris,
            client_name,
        },
    )
    .await
    {
        Ok(client) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({
                "client_id": client.client_id,
                "client_secret": client.client_secret,
                "redirect_uris": client.redirect_uris,
            }),
            201,
        ),
        Err(err) => oauth_error(&cx, err),
    }
}
