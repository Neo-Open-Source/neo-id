use std::collections::HashMap;

use auth_core::AuthError;
use db::Kv as _;
use worker::{
    Fetch, Headers, Method, Request, RequestInit, Response, RouteContext, wasm_bindgen::JsValue,
};

use crate::kv::StatesKv;
use crate::respond::fail;
use crate::routes::{Ctx, fail_status, kv_store, load_cx, worker_rng};

struct Provider {
    client_id: String,
    client_secret: String,
    authorize: &'static str,
    token: &'static str,
}

fn provider(cx: &Ctx, name: &str) -> Option<Provider> {
    match name {
        "google" => Some(Provider {
            client_id: cx.app.google_client_id.clone()?,
            client_secret: cx.app.google_client_secret.clone()?,
            authorize: "https://accounts.google.com/o/oauth2/v2/auth",
            token: "https://oauth2.googleapis.com/token",
        }),
        "github" => Some(Provider {
            client_id: cx.app.github_client_id.clone()?,
            client_secret: cx.app.github_client_secret.clone()?,
            authorize: "https://github.com/login/oauth/authorize",
            token: "https://github.com/login/oauth/access_token",
        }),
        _ => None,
    }
}

fn callback_url(cx: &Ctx, name: &str) -> String {
    format!("{}/api/v1/oauth/{name}/callback", cx.app.issuer)
}

fn state_key(state: &str) -> String {
    format!("oauthstate:{state}")
}

fn web_error(cx: &Ctx, code: &str) -> worker::Result<Response> {
    redirect_to(&format!("{}/auth?error={code}", cx.app.web_origin))
}

fn redirect_to(target: &str) -> worker::Result<Response> {
    let url = url::Url::parse(target)
        .map_err(|_| worker::Error::RustError("bad redirect".to_string()))?;
    Response::redirect(url)
}

fn safe_redirect(cx: &Ctx, raw: &str) -> String {
    let allowed = raw.starts_with(&cx.app.web_origin) || raw.starts_with("http://localhost");
    if allowed && raw.len() > 1 {
        raw.to_string()
    } else {
        cx.app.web_origin.clone()
    }
}

async fn get_json(url: &str, bearer: Option<&str>) -> Result<serde_json::Value, AuthError> {
    let headers = Headers::new();
    headers
        .set("accept", "application/json")
        .map_err(|_| AuthError::Internal)?;
    headers
        .set("user-agent", "neo-auth")
        .map_err(|_| AuthError::Internal)?;
    if let Some(token) = bearer {
        headers
            .set("authorization", &format!("Bearer {token}"))
            .map_err(|_| AuthError::Internal)?;
    }
    let mut init = RequestInit::new();
    init.with_method(Method::Get).with_headers(headers);
    let request = Request::new_with_init(url, &init).map_err(|_| AuthError::Internal)?;
    let mut response = Fetch::Request(request)
        .send()
        .await
        .map_err(|_| AuthError::Internal)?;
    response.json().await.map_err(|_| AuthError::Internal)
}

async fn post_form(url: &str, form: &str) -> Result<serde_json::Value, AuthError> {
    let headers = Headers::new();
    headers
        .set("content-type", "application/x-www-form-urlencoded")
        .map_err(|_| AuthError::Internal)?;
    headers
        .set("accept", "application/json")
        .map_err(|_| AuthError::Internal)?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post)
        .with_headers(headers)
        .with_body(Some(JsValue::from_str(form)));
    let request = Request::new_with_init(url, &init).map_err(|_| AuthError::Internal)?;
    let mut response = Fetch::Request(request)
        .send()
        .await
        .map_err(|_| AuthError::Internal)?;
    response.json().await.map_err(|_| AuthError::Internal)
}

async fn fetch_identity(name: &str, access_token: &str) -> Result<(String, String), AuthError> {
    match name {
        "google" => {
            let info = get_json(
                "https://openidconnect.googleapis.com/v1/userinfo",
                Some(access_token),
            )
            .await?;
            let sub = info
                .get("sub")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let email = info
                .get("email")
                .and_then(serde_json::Value::as_str)
                .unwrap_or_default();
            let verified = info
                .get("email_verified")
                .and_then(serde_json::Value::as_bool)
                .unwrap_or(false);
            if sub.is_empty() || !verified {
                return Err(AuthError::InvalidCredentials);
            }
            Ok((sub.to_string(), email.to_lowercase()))
        }
        "github" => {
            let user = get_json("https://api.github.com/user", Some(access_token)).await?;
            let id = user.get("id").map(ToString::to_string).unwrap_or_default();
            let email = match user.get("email").and_then(serde_json::Value::as_str) {
                Some(value) if !value.is_empty() => value.to_lowercase(),
                _ => {
                    let emails =
                        get_json("https://api.github.com/user/emails", Some(access_token)).await?;
                    let list = emails.as_array().cloned().unwrap_or_default();
                    list.iter()
                        .find(|entry| {
                            entry.get("primary").and_then(serde_json::Value::as_bool) == Some(true)
                                && entry.get("verified").and_then(serde_json::Value::as_bool)
                                    == Some(true)
                        })
                        .or_else(|| {
                            list.iter().find(|entry| {
                                entry.get("verified").and_then(serde_json::Value::as_bool)
                                    == Some(true)
                            })
                        })
                        .and_then(|entry| entry.get("email").and_then(serde_json::Value::as_str))
                        .unwrap_or_default()
                        .to_lowercase()
                }
            };
            if id.is_empty() || email.is_empty() {
                return Err(AuthError::InvalidCredentials);
            }
            Ok((id, email))
        }
        _ => Err(AuthError::Internal),
    }
}

pub async fn start(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let name = ctx.param("provider").cloned().unwrap_or_default();
    let Some(provider) = provider(&cx, &name) else {
        return fail_status(&cx, 404, "PROVIDER_UNKNOWN", "Unknown provider");
    };
    let Ok(url) = req.url() else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    let mut redirect = String::new();
    if let Some((_, value)) = url.query_pairs().find(|(key, _)| key == "redirect") {
        redirect = value.to_string();
    }
    let store = match kv_store(&ctx) {
        Ok(store) => StatesKv::new(store),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let state = auth_core::generate_id(&mut rng);
    let saved = serde_json::json!({"provider": name.clone(), "redirect": redirect.clone()});
    let Ok(bytes) = serde_json::to_vec(&saved) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
    };
    if store.put(&state_key(&state), &bytes, 600).await.is_err() {
        return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
    }
    let query = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", &provider.client_id)
        .append_pair("redirect_uri", &callback_url(&cx, &name))
        .append_pair("response_type", "code")
        .append_pair(
            "scope",
            if name == "google" {
                "openid email profile"
            } else {
                "read:user user:email"
            },
        )
        .append_pair("state", &state)
        .finish();
    let target = format!("{}?{}", provider.authorize, query);
    redirect_to(&target)
}

pub async fn callback(req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let name = ctx.param("provider").cloned().unwrap_or_default();
    let Some(provider) = provider(&cx, &name) else {
        return web_error(&cx, "oauth");
    };
    let Ok(url) = req.url() else {
        return web_error(&cx, "oauth");
    };
    let query: HashMap<String, String> = url.query_pairs().into_owned().collect();
    let state = query.get("state").cloned().unwrap_or_default();
    let code = query.get("code").cloned().unwrap_or_default();
    if state.is_empty() || code.is_empty() {
        return web_error(&cx, "oauth");
    }
    let store = match kv_store(&ctx) {
        Ok(store) => StatesKv::new(store),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(Some(bytes)) = store.get(&state_key(&state)).await else {
        return web_error(&cx, "oauth");
    };
    let _ = store.delete(&state_key(&state)).await;
    let saved: serde_json::Value =
        serde_json::from_slice(&bytes).unwrap_or(serde_json::Value::Null);
    let redirect = saved
        .get("redirect")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_string();
    let form = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("client_id", &provider.client_id)
        .append_pair("client_secret", &provider.client_secret)
        .append_pair("code", &code)
        .append_pair("grant_type", "authorization_code")
        .append_pair("redirect_uri", &callback_url(&cx, &name))
        .finish();
    let Ok(token) = post_form(provider.token, &form).await else {
        return web_error(&cx, "oauth");
    };
    let access_token = token
        .get("access_token")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default()
        .to_string();
    if access_token.is_empty() {
        return web_error(&cx, "oauth");
    }
    let Ok((provider_user_id, email)) = fetch_identity(&name, &access_token).await else {
        return web_error(&cx, "oauth");
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(user) = auth_accounts::resolve_social_user(
        &cx.db,
        &mut rng,
        &name,
        &provider_user_id,
        &email,
        cx.now,
    )
    .await
    else {
        return web_error(&cx, "oauth");
    };
    let device = crate::routes::header_opt(&req, "user-agent");
    let ip = crate::routes::header_opt(&req, "cf-connecting-ip");
    let params = auth_accounts::MintParams {
        signing: &cx.app.signing,
        issuer: &cx.app.issuer,
        device: device.as_deref(),
        ip: ip.as_deref(),
        audience: None,
    };
    let Ok(tokens) = auth_accounts::complete_login(&cx.db, &mut rng, cx.now, &params, &user).await
    else {
        return web_error(&cx, "oauth");
    };
    let target = safe_redirect(&cx, &redirect);
    let response = redirect_to(&target)?;
    crate::respond::with_cookies(
        Ok(response),
        &tokens.access_token,
        &tokens.refresh_token,
        auth_core::REFRESH_EXPIRY,
    )
}
