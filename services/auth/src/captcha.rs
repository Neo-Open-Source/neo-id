use auth_core::{AltchaPayload, AuthError, create_altcha_challenge, verify_altcha};
use base64::{Engine, engine::general_purpose::STANDARD};
use worker::{Fetch, Headers, Method, Request, RequestInit, Response, ResponseBody, RouteContext};

use crate::respond::{fail, ok};
use crate::routes::{Ctx, fail_status, header_opt, load_cx, worker_rng};

const LITE_HEADER: &str = "x-neo-client";
const SITEVERIFY: &str = "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const ALTCHA_JS: &str = include_str!("../assets/altcha.js");

pub enum Captcha {
    Pass,
    Missing,
    Invalid,
}

fn is_lite(header: Option<&str>) -> bool {
    header == Some("lite")
}

pub async fn verify(
    cx: &Ctx,
    req: &Request,
    body: &serde_json::Value,
) -> Result<Captcha, AuthError> {
    if is_lite(header_opt(req, LITE_HEADER).as_deref()) {
        return check_altcha(cx, body);
    }
    verify_turnstile(cx, req, body).await
}

fn check_altcha(cx: &Ctx, body: &serde_json::Value) -> Result<Captcha, AuthError> {
    let Some(secret) = cx.app.altcha_secret.as_deref() else {
        return Ok(Captcha::Pass);
    };
    let payload = body
        .get("altcha")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if payload.is_empty() {
        return Ok(Captcha::Missing);
    }
    let Ok(bytes) = STANDARD.decode(payload) else {
        return Ok(Captcha::Invalid);
    };
    let Ok(parsed) = serde_json::from_slice::<AltchaPayload>(&bytes) else {
        return Ok(Captcha::Invalid);
    };
    if verify_altcha(&parsed, secret, cx.now)? {
        Ok(Captcha::Pass)
    } else {
        Ok(Captcha::Invalid)
    }
}

async fn verify_turnstile(
    cx: &Ctx,
    req: &Request,
    body: &serde_json::Value,
) -> Result<Captcha, AuthError> {
    let Some(secret) = cx.app.turnstile_secret.as_deref() else {
        return Ok(Captcha::Pass);
    };
    let token = body
        .get("cf_turnstile_response")
        .and_then(serde_json::Value::as_str)
        .unwrap_or_default();
    if token.is_empty() {
        return Ok(Captcha::Missing);
    }
    let ip = header_opt(req, "cf-connecting-ip").unwrap_or_default();
    let form = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("secret", secret)
        .append_pair("response", token)
        .append_pair("remoteip", &ip)
        .finish();
    let headers = Headers::new();
    headers
        .set("Content-Type", "application/x-www-form-urlencoded")
        .map_err(|_| AuthError::Internal)?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post);
    init.with_headers(headers);
    init.with_body(Some(worker::wasm_bindgen::JsValue::from_str(&form)));
    let request = Request::new_with_init(SITEVERIFY, &init).map_err(|_| AuthError::Internal)?;
    let mut response = Fetch::Request(request)
        .send()
        .await
        .map_err(|_| AuthError::Internal)?;
    let json: serde_json::Value = response.json().await.map_err(|_| AuthError::Internal)?;
    match json.get("success").and_then(serde_json::Value::as_bool) {
        Some(true) => Ok(Captcha::Pass),
        _ => Ok(Captcha::Invalid),
    }
}

pub async fn altcha_challenge(_req: Request, ctx: RouteContext<()>) -> worker::Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let Some(secret) = cx.app.altcha_secret.as_deref() else {
        return fail_status(&cx, 404, "CAPTCHA_DISABLED", "ALTCHA is not enabled");
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match create_altcha_challenge(&mut rng, secret, cx.now, auth_core::ALTCHA_COST) {
        Ok(challenge) => match serde_json::to_value(&challenge) {
            Ok(data) => ok(&cx.request_id, cx.now_ms, &data, 200),
            Err(_) => fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
        },
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn altcha_script(_req: Request, _ctx: RouteContext<()>) -> worker::Result<Response> {
    let mut response = Response::from_body(ResponseBody::Body(ALTCHA_JS.as_bytes().to_vec()))?;
    let headers = response.headers_mut();
    headers.set("content-type", "application/javascript; charset=utf-8")?;
    headers.set("cache-control", "public, max-age=86400")?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::is_lite;

    #[test]
    fn is_lite_requires_exact_header() {
        assert!(is_lite(Some("lite")));
        assert!(!is_lite(Some("LITE")));
        assert!(!is_lite(Some("full")));
        assert!(!is_lite(None));
    }
}
