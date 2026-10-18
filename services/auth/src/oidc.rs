use auth_core::{AuthError, percent_encode, verify_access, verify_id};
use auth_oidc::{
    AuthorizationCode, AuthorizeRequest, ClientRegistrationRequest, ConsentChoice, ConsentRequest,
    Grant, LogoutRequest, TokenRequest, UserInfoRequest, WireError, authorize, decide_consent,
    logout, register, token, userinfo,
};
use base64::{Engine, engine::general_purpose::STANDARD};
use worker::{Request, Response, Result, RouteContext};

use super::{
    respond::{fail, no_store, ok, unauthorized},
    routes::{
        Ctx, cookie_value, fail_status, form_or_json, header_opt, kv_store, load_cx, worker_rng,
    },
};

fn code_key(code: &str) -> String {
    format!("acn:{code}")
}

fn pending_key(state: &str) -> String {
    format!("acp:{state}")
}

async fn put_state<K: db::Kv>(
    store: &K,
    key: &str,
    state: &AuthorizationCode,
) -> Result<(), AuthError> {
    auth_oidc::store_authcode_state(store, key, state).await
}

async fn take_state<K: db::Kv>(
    store: &K,
    key: &str,
) -> Result<Option<AuthorizationCode>, AuthError> {
    auth_oidc::take_authcode_state(store, key).await
}

fn basic_credentials(header: Option<&str>) -> Option<(String, String)> {
    let encoded = header?.strip_prefix("Basic ")?;
    let decoded = STANDARD.decode(encoded.trim()).ok()?;
    let text = String::from_utf8(decoded).ok()?;
    let (id, secret) = text.split_once(':')?;
    Some((form_decode(id), form_decode(secret)))
}

fn form_decode(value: &str) -> String {
    url::form_urlencoded::parse(format!("v={value}").as_bytes())
        .next()
        .map(|(_, decoded)| decoded.into_owned())
        .unwrap_or_default()
}

fn wire_error_status(err: WireError) -> u16 {
    match err {
        WireError::InvalidClient => 401,
        WireError::ServerError => 500,
        _ => 400,
    }
}

fn oauth_error(cx: &Ctx, err: WireError) -> Result<Response> {
    let status = wire_error_status(err);
    Response::from_json(&serde_json::json!({"error": err.as_str()}))
        .map(|response| response.with_status(status))
        .or_else(|_| fail(&cx.request_id, cx.now_ms, &AuthError::Internal))
}

fn logged_user_from(
    cx: &Ctx,
    header: Option<&str>,
    cookie: Option<&str>,
) -> Option<(String, Option<String>, u64)> {
    let presented = header
        .and_then(|value| value.strip_prefix("Bearer ").map(String::from))
        .or_else(|| cookie.map(String::from))?;
    let claims = verify_access(&cx.app.verify, &presented, &cx.app.issuer, cx.now).ok()?;
    let auth_time = claims
        .auth_time_unix
        .and_then(|value| u64::try_from(value).ok())
        .unwrap_or(0);
    Some((claims.sub, claims.session_id, auth_time))
}

fn query_pairs(url: &url::Url) -> std::collections::HashMap<String, String> {
    url.query_pairs().into_owned().collect()
}

fn some_query(params: &std::collections::HashMap<String, String>, key: &str) -> Option<String> {
    params.get(key).filter(|value| !value.is_empty()).cloned()
}

fn authorize_request(
    params: &std::collections::HashMap<String, String>,
    url: &url::Url,
    user: Option<&(String, Option<String>, u64)>,
) -> AuthorizeRequest {
    let required = |key: &str| params.get(key).cloned().unwrap_or_default();
    AuthorizeRequest {
        response_type: required("response_type"),
        client_id: required("client_id"),
        redirect_uri: required("redirect_uri"),
        scope: required("scope"),
        state: some_query(params, "state"),
        nonce: some_query(params, "nonce"),
        prompt: some_query(params, "prompt"),
        response_mode: some_query(params, "response_mode"),
        max_age: some_query(params, "max_age").and_then(|value| value.parse::<u64>().ok()),
        code_challenge: some_query(params, "code_challenge"),
        code_challenge_method: some_query(params, "code_challenge_method"),
        user_id: user.map(|(sub, _, _)| sub.clone()),
        session_id: user.and_then(|(_, session, _)| session.clone()),
        auth_time: user
            .map(|(_, _, auth_time)| *auth_time)
            .filter(|auth_time| *auth_time > 0),
        login_url: format!("/auth?redirect={}", percent_encode(url.as_str())),
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum GrantKind {
    Code,
    Refresh,
    Unsupported,
}

fn grant_kind(grant_type: &str) -> GrantKind {
    match grant_type {
        "authorization_code" => GrantKind::Code,
        "refresh_token" => GrantKind::Refresh,
        _ => GrantKind::Unsupported,
    }
}

fn client_credentials(
    client_id: String,
    client_secret: Option<String>,
    basic: Option<(String, String)>,
) -> (String, Option<String>) {
    match basic {
        Some((id, secret)) => (id, Some(secret)),
        None => (client_id, client_secret),
    }
}

fn logout_field(
    params: &std::collections::HashMap<String, String>,
    body: &serde_json::Value,
    key: &str,
) -> Option<String> {
    some_query(params, key).or_else(|| {
        body.get(key)
            .and_then(serde_json::Value::as_str)
            .filter(|value| !value.is_empty())
            .map(String::from)
    })
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
    let user = logged_user_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    );
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match authorize(
        &cx.db,
        &mut rng,
        cx.now,
        authorize_request(&params, &url, user.as_ref()),
    )
    .await
    {
        Ok(auth_oidc::AuthorizeOutcome::Consent {
            state,
            redirect_uri,
            service_app_id,
            nonce,
            scopes,
        }) => {
            let pending = AuthorizationCode {
                nonce: nonce.clone(),
                scopes: scopes.clone(),
            };
            let store = match kv_store(&ctx) {
                Ok(store) => crate::kv::StatesKv::new(store),
                Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
            };
            if let Err(err) = put_state(&store, &pending_key(&state), &pending).await {
                return fail(&cx.request_id, cx.now_ms, &err);
            }
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({
                    "consent_required": true,
                    "state": state,
                    "redirect_uri": redirect_uri,
                    "service_app_id": service_app_id,
                    "nonce": nonce,
                    "scopes": scopes,
                }),
                200,
            )
        }
        Ok(
            auth_oidc::AuthorizeOutcome::Login { url } | auth_oidc::AuthorizeOutcome::Error { url },
        ) => match url::Url::parse(&url) {
            Ok(target) => Response::redirect(target),
            Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
        },
        Ok(auth_oidc::AuthorizeOutcome::Granted {
            url,
            code,
            nonce,
            scopes,
        }) => {
            let state = AuthorizationCode { nonce, scopes };
            let store = match kv_store(&ctx) {
                Ok(store) => crate::kv::StatesKv::new(store),
                Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
            };
            if let Err(err) = put_state(&store, &code_key(&code), &state).await {
                return fail(&cx.request_id, cx.now_ms, &err);
            }
            match url::Url::parse(&url) {
                Ok(target) => Response::redirect(target),
                Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
            }
        }
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
    let Some(user) = logged_user_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) else {
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
    let state = optional("state");
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
    };
    let pending = match state.as_deref() {
        Some(state) => match take_state(&store, &pending_key(state)).await {
            Ok(Some(pending)) => pending,
            Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        },
        None => return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage),
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
            state,
            code_challenge: optional("code_challenge"),
        },
    )
    .await
    {
        Ok(redirect) => {
            if let Some(code) = redirect.code.as_deref() {
                let store = match kv_store(&ctx) {
                    Ok(store) => crate::kv::StatesKv::new(store),
                    Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
                };
                if let Err(err) = put_state(&store, &code_key(code), &pending).await {
                    return fail(&cx.request_id, cx.now_ms, &err);
                }
            }
            match url::Url::parse(&redirect.url) {
                Ok(target) => Response::redirect(target),
                Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
            }
        }
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn token_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body: serde_json::Value = match form_or_json(&mut req).await {
        Ok(body) => body,
        Err(err) => return no_store(fail(&cx.request_id, cx.now_ms, &err)),
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
    let basic = basic_credentials(header_opt(&req, "authorization").as_deref());
    let (client_id, client_secret) =
        client_credentials(field("client_id"), optional("client_secret"), basic);
    let grant = match grant_kind(&field("grant_type")) {
        GrantKind::Code => {
            let code = field("code");
            let state = if code.is_empty() {
                AuthorizationCode::default()
            } else {
                let store = match kv_store(&ctx) {
                    Ok(store) => crate::kv::StatesKv::new(store),
                    Err(_) => {
                        return no_store(fail(&cx.request_id, cx.now_ms, &AuthError::Internal));
                    }
                };
                match take_state(&store, &code_key(&code)).await {
                    Ok(Some(state)) => state,
                    Ok(None) => AuthorizationCode::default(),
                    Err(err) => return no_store(fail(&cx.request_id, cx.now_ms, &err)),
                }
            };
            Grant::Code {
                code,
                redirect_uri: field("redirect_uri"),
                client_id,
                client_secret,
                code_verifier: optional("code_verifier"),
                nonce: state.nonce,
                scopes: state.scopes,
            }
        }
        GrantKind::Refresh => Grant::Refresh {
            refresh_token: field("refresh_token"),
            client_id,
            client_secret,
        },
        GrantKind::Unsupported => {
            return no_store(oauth_error(&cx, WireError::UnsupportedGrantType));
        }
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    no_store(
        match token(
            &cx.db,
            &mut rng,
            cx.now,
            &cx.app.signing,
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
        },
    )
}

pub async fn userinfo_route(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let Some(presented) = header_opt(&req, "authorization")
        .and_then(|header| header.strip_prefix("Bearer ").map(String::from))
    else {
        return unauthorized(&cx.request_id, cx.now_ms, "Missing access token");
    };
    let Ok(claims) = verify_access(&cx.app.verify, &presented, &cx.app.issuer, cx.now) else {
        return unauthorized(&cx.request_id, cx.now_ms, "Invalid access token");
    };
    let request = UserInfoRequest {
        sub: claims.sub,
        scope: claims.scope,
    };
    match userinfo(&cx.db, request).await {
        Ok(info) => match serde_json::to_value(&info) {
            Ok(data) => ok(&cx.request_id, cx.now_ms, &data, 200),
            Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
        },
        Err(err) => oauth_error(&cx, err),
    }
}

pub async fn logout_route(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let params = req.url().map(|url| query_pairs(&url)).unwrap_or_default();
    let body: serde_json::Value = req.json().await.unwrap_or(serde_json::Value::Null);
    let field = |key: &str| logout_field(&params, &body, key);
    let user_id = field("user_id").or_else(|| {
        field("id_token_hint").and_then(|token| {
            verify_id(&cx.app.verify, &token, &cx.app.issuer, cx.now)
                .ok()
                .map(|claims| claims.sub)
        })
    });
    match logout(
        &cx.db,
        LogoutRequest {
            session_id: field("session_id"),
            user_id,
            post_logout_redirect: field("post_logout_redirect_uri"),
            state: field("state"),
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
    let Some(user) = logged_user_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) else {
        return fail_status(
            &cx,
            401,
            "UNAUTHORIZED",
            "Client registration requires authentication",
        );
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
        ClientRegistrationRequest {
            owner_id: user.0,
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
                "client_id_issued_at": client.created_at,
                "client_secret_expires_at": 0,
                "token_endpoint_auth_method": "client_secret_basic",
                "redirect_uris": client.redirect_uris,
                "grant_types": ["authorization_code", "refresh_token"],
                "response_types": ["code"],
                "scope": "openid profile email",
            }),
            201,
        ),
        Err(err) => oauth_error(&cx, err),
    }
}

#[cfg(test)]
mod tests {
    use super::{
        GrantKind, authorize_request, basic_credentials, client_credentials, code_key, form_decode,
        grant_kind, logged_user_from, logout_field, pending_key, put_state, query_pairs,
        some_query, take_state, wire_error_status,
    };
    use auth_core::AuthError;
    use auth_oidc::{AuthorizationCode, WireError};
    use base64::{Engine, engine::general_purpose::STANDARD};
    use db::Kv;
    use std::collections::HashMap;

    fn basic(id: &str, secret: &str) -> String {
        format!("Basic {}", STANDARD.encode(format!("{id}:{secret}")))
    }

    #[test]
    fn basic_credentials_decode_and_form_decode() {
        let header = basic("web-app", "a+b/c%20d");
        assert_eq!(
            basic_credentials(Some(&header)),
            Some(("web-app".to_string(), "a b/c d".to_string()))
        );
        assert_eq!(basic_credentials(Some("Bearer x")), None);
        assert_eq!(basic_credentials(Some("Basic !!!")), None);
    }

    #[test]
    fn form_decode_keeps_equals_and_plus() {
        assert_eq!(form_decode("a%3Db"), "a=b");
        assert_eq!(form_decode("x+y"), "x y");
    }

    #[test]
    fn query_pairs_collects_params() {
        let url = url::Url::parse("https://x/a?state=s&code=c&empty=").unwrap();
        let params = query_pairs(&url);
        assert_eq!(params.get("state").map(String::as_str), Some("s"));
        assert_eq!(params.get("code").map(String::as_str), Some("c"));
        assert_eq!(params.get("empty").map(String::as_str), Some(""));
    }

    #[test]
    fn kv_keys_are_namespaced() {
        assert_eq!(code_key("abc"), "acn:abc");
        assert_eq!(pending_key("st"), "acp:st");
    }

    #[test]
    fn wire_error_status_maps_client_and_server() {
        assert_eq!(wire_error_status(WireError::InvalidClient), 401);
        assert_eq!(wire_error_status(WireError::ServerError), 500);
        assert_eq!(wire_error_status(WireError::InvalidRequest), 400);
        assert_eq!(wire_error_status(WireError::AccessDenied), 400);
    }

    #[test]
    fn logged_user_from_accepts_bearer_or_cookie() {
        let cx = crate::test_support::test_ctx(1_800_000_000);
        let token = crate::test_support::test_access_token(&cx);
        let bearer = format!("Bearer {token}");
        assert_eq!(
            logged_user_from(&cx, Some(&bearer), None)
                .map(|(sub, _, _)| sub)
                .as_deref(),
            Some("u1")
        );
        assert_eq!(
            logged_user_from(&cx, None, Some(&token))
                .map(|(sub, _, _)| sub)
                .as_deref(),
            Some("u1")
        );
        assert!(logged_user_from(&cx, Some("Bearer nope"), None).is_none());
        assert!(logged_user_from(&cx, None, None).is_none());
    }

    #[test]
    fn some_query_skips_empty_values() {
        let mut params = HashMap::new();
        params.insert("a".to_string(), "1".to_string());
        params.insert("b".to_string(), String::new());
        assert_eq!(some_query(&params, "a").as_deref(), Some("1"));
        assert_eq!(some_query(&params, "b"), None);
        assert_eq!(some_query(&params, "missing"), None);
    }

    #[test]
    fn authorize_request_parses_params_and_user() {
        let url = url::Url::parse(
            "https://id.neome.uk/api/v1/oauth2/authorize?response_type=code&client_id=c&redirect_uri=https%3A%2F%2Fapp%2Fcb&scope=openid+profile&state=s&nonce=n&max_age=120",
        )
        .unwrap();
        let params = query_pairs(&url);
        let user = ("u1".to_string(), Some("sess".to_string()), 1_800_000_000);
        let request = authorize_request(&params, &url, Some(&user));
        assert_eq!(request.response_type, "code");
        assert_eq!(request.client_id, "c");
        assert_eq!(request.redirect_uri, "https://app/cb");
        assert_eq!(request.scope, "openid profile");
        assert_eq!(request.state.as_deref(), Some("s"));
        assert_eq!(request.nonce.as_deref(), Some("n"));
        assert_eq!(request.max_age, Some(120));
        assert_eq!(request.user_id.as_deref(), Some("u1"));
        assert_eq!(request.session_id.as_deref(), Some("sess"));
        assert_eq!(request.auth_time, Some(1_800_000_000));
        assert!(request.login_url.starts_with("/auth?redirect="));
    }

    #[test]
    fn authorize_request_omits_zero_auth_time_and_bad_max_age() {
        let url = url::Url::parse("https://id.neome.uk/a?max_age=abc&state=").unwrap();
        let params = query_pairs(&url);
        let user = ("u1".to_string(), None, 0);
        let request = authorize_request(&params, &url, Some(&user));
        assert_eq!(request.auth_time, None);
        assert_eq!(request.max_age, None);
        assert_eq!(request.state, None);
        assert_eq!(request.client_id, "");

        let anonymous = authorize_request(&params, &url, None);
        assert_eq!(anonymous.user_id, None);
        assert_eq!(anonymous.session_id, None);
        assert_eq!(anonymous.auth_time, None);
    }

    #[test]
    fn grant_kind_maps_known_grants() {
        assert_eq!(grant_kind("authorization_code"), GrantKind::Code);
        assert_eq!(grant_kind("refresh_token"), GrantKind::Refresh);
        assert_eq!(grant_kind("client_credentials"), GrantKind::Unsupported);
    }

    #[test]
    fn client_credentials_prefers_basic_auth() {
        assert_eq!(
            client_credentials(
                "body-id".to_string(),
                Some("body-secret".to_string()),
                Some(("basic-id".to_string(), "basic-secret".to_string())),
            ),
            ("basic-id".to_string(), Some("basic-secret".to_string()))
        );
        assert_eq!(
            client_credentials("body-id".to_string(), None, None),
            ("body-id".to_string(), None)
        );
    }

    #[test]
    fn logout_field_prefers_query_then_nonempty_body() {
        let mut params = HashMap::new();
        params.insert("state".to_string(), "from-query".to_string());
        let body = serde_json::json!({"state": "from-body", "session_id": "sid", "empty": ""});
        assert_eq!(
            logout_field(&params, &body, "state").as_deref(),
            Some("from-query")
        );
        assert_eq!(
            logout_field(&params, &body, "session_id").as_deref(),
            Some("sid")
        );
        assert_eq!(logout_field(&params, &body, "empty"), None);
        assert_eq!(logout_field(&params, &body, "missing"), None);
    }

    #[derive(Default)]
    struct MemKv {
        data: std::sync::Mutex<HashMap<String, Vec<u8>>>,
    }

    impl Kv for MemKv {
        fn get(
            &self,
            key: &str,
        ) -> impl std::future::Future<Output = Result<Option<Vec<u8>>, AuthError>> {
            let value = self
                .data
                .lock()
                .map(|data| data.get(key).cloned())
                .map_err(|_| AuthError::Internal);
            async move { value }
        }

        fn put(
            &self,
            key: &str,
            value: &[u8],
            _ttl_secs: u64,
        ) -> impl std::future::Future<Output = Result<(), AuthError>> {
            let result = self
                .data
                .lock()
                .map(|mut data| {
                    data.insert(key.to_string(), value.to_vec());
                })
                .map_err(|_| AuthError::Internal);
            async move { result }
        }

        fn delete(&self, key: &str) -> impl std::future::Future<Output = Result<(), AuthError>> {
            let result = self
                .data
                .lock()
                .map(|mut data| {
                    data.remove(key);
                })
                .map_err(|_| AuthError::Internal);
            async move { result }
        }
    }

    #[tokio::test]
    async fn authcode_state_roundtrips_and_is_single_use() {
        let kv = MemKv::default();
        let state = AuthorizationCode {
            nonce: Some("n-1".to_string()),
            scopes: vec!["openid".to_string(), "email".to_string()],
        };
        put_state(&kv, "k", &state).await.unwrap();
        let taken = take_state(&kv, "k").await.unwrap().unwrap();
        assert_eq!(taken.nonce.as_deref(), Some("n-1"));
        assert_eq!(
            taken.scopes,
            vec!["openid".to_string(), "email".to_string()]
        );
        assert!(take_state(&kv, "k").await.unwrap().is_none());
    }
}
