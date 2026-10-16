use serde::Deserialize;
use subtle::ConstantTimeEq;
use worker::{Env, Request, Response, Result, RouteContext, Router};

use crate::{
    brand::Brand,
    resend::{self, MailError},
    templates,
};

#[derive(Debug, Deserialize)]
pub(crate) struct BrandInput {
    pub(crate) name: Option<String>,
    pub(crate) accent: Option<String>,
    pub(crate) logo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub(crate) struct SendRequest {
    pub(crate) to: String,
    pub(crate) kind: String,
    pub(crate) code: Option<String>,
    pub(crate) link: Option<String>,
    pub(crate) title: Option<String>,
    pub(crate) body: Option<String>,
    pub(crate) locale: Option<String>,
    pub(crate) brand: Option<BrandInput>,
}

#[derive(Debug, PartialEq, Eq)]
pub(crate) struct Content {
    pub(crate) subject: String,
    pub(crate) text: String,
    pub(crate) html: String,
}

#[must_use]
pub(crate) fn authorized(provided: Option<&str>, expected: &str) -> bool {
    match provided {
        None => false,
        Some(given) => {
            !expected.is_empty() && bool::from(given.as_bytes().ct_eq(expected.as_bytes()))
        }
    }
}

#[must_use]
pub(crate) fn valid_recipient(to: &str) -> bool {
    !to.is_empty() && to.contains('@')
}

fn present(value: Option<&str>) -> Option<&str> {
    value.filter(|text| !text.is_empty())
}

pub(crate) fn resolve(request: &SendRequest) -> Result<Content, MailError> {
    let brand = match request.brand.as_ref() {
        Some(input) => Brand::sanitize(
            input.name.as_deref(),
            input.accent.as_deref(),
            input.logo_url.as_deref(),
        ),
        None => Brand::neo_id(),
    };
    match request.kind.as_str() {
        "verify_code" => {
            let code = present(request.code.as_deref()).ok_or(MailError::InvalidRequest)?;
            Ok(Content {
                subject: format!("{} verification code", brand.name),
                text: format!("Your {} verification code is: {code}", brand.name),
                html: templates::verify_action(&brand, code),
            })
        }
        "login_code" => {
            let code = present(request.code.as_deref()).ok_or(MailError::InvalidRequest)?;
            Ok(Content {
                subject: format!("{} login code", brand.name),
                text: format!("Your {} login code is: {code}", brand.name),
                html: templates::mfa_code(&brand, code),
            })
        }
        "verify_email" => {
            let code = present(request.code.as_deref()).ok_or(MailError::InvalidRequest)?;
            let link = present(request.link.as_deref()).ok_or(MailError::InvalidRequest)?;
            Ok(Content {
                subject: format!("Verify your email — {}", brand.name),
                text: format!(
                    "Your {} verification code is: {code}. Or open: {link}",
                    brand.name
                ),
                html: templates::verify_email(&brand, code, link),
            })
        }
        "reset_password" => {
            let link = present(request.link.as_deref()).ok_or(MailError::InvalidRequest)?;
            Ok(Content {
                subject: format!("Reset your password — {}", brand.name),
                text: format!("Click the link to reset your password: {link}"),
                html: templates::reset_password(&brand, link),
            })
        }
        "security_notice" => {
            let title = present(request.title.as_deref()).ok_or(MailError::InvalidRequest)?;
            let body = present(request.body.as_deref()).ok_or(MailError::InvalidRequest)?;
            Ok(Content {
                subject: title.to_string(),
                text: body.to_string(),
                html: templates::security_notice(&brand, title, body),
            })
        }
        _ => Err(MailError::UnknownKind),
    }
}

#[must_use]
pub(crate) fn status_of(err: &MailError) -> (u16, &'static str, &'static str) {
    match err {
        MailError::Unauthorized => (401, "UNAUTHORIZED", "Invalid mail key"),
        MailError::InvalidRequest => (400, "INVALID_REQUEST", "Malformed request"),
        MailError::UnknownKind => (400, "UNKNOWN_KIND", "Unknown email kind"),
        MailError::Internal => (500, "INTERNAL", "Internal error"),
    }
}

fn fail(timestamp: u64, err: &MailError) -> Result<Response> {
    let (status, code, message) = status_of(err);
    Response::from_json(&serde_json::json!({
        "ok": false,
        "error": {"code": code, "message": message, "status": status},
        "meta": {"timestamp": timestamp},
    }))
    .map(|response| response.with_status(status))
}

fn ok(timestamp: u64, data: &serde_json::Value) -> Result<Response> {
    Response::from_json(&serde_json::json!({
        "ok": true,
        "data": data,
        "meta": {"timestamp": timestamp},
    }))
    .map(|response| response.with_status(200))
}

fn secret(env: &Env, name: &str) -> std::result::Result<String, MailError> {
    let value = env
        .secret(name)
        .map_err(|_| MailError::Internal)?
        .to_string();
    if value.is_empty() {
        return Err(MailError::Internal);
    }
    Ok(value)
}

async fn health(_req: Request, _ctx: RouteContext<()>) -> Result<Response> {
    ok(
        worker::Date::now().as_millis(),
        &serde_json::json!({"status": "ok"}),
    )
}

async fn send_email(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let now_ms = worker::Date::now().as_millis();
    let expected = match secret(&ctx.env, "MAIL_API_KEY") {
        Ok(expected) => expected,
        Err(err) => return fail(now_ms, &err),
    };
    let given = req.headers().get("x-mail-key").ok().flatten();
    if !authorized(given.as_deref(), &expected) {
        return fail(now_ms, &MailError::Unauthorized);
    }
    let request: SendRequest = match req.json().await {
        Ok(request) => request,
        Err(_) => return fail(now_ms, &MailError::InvalidRequest),
    };
    let _ = request.locale.as_deref();
    if !valid_recipient(&request.to) {
        return fail(now_ms, &MailError::InvalidRequest);
    }
    let content = match resolve(&request) {
        Ok(content) => content,
        Err(err) => return fail(now_ms, &err),
    };
    let from = ctx
        .env
        .var("MAIL_FROM")
        .map_or(String::from("Neo ID <noreply@id.neome.uk>"), |value| {
            value.to_string()
        });
    let api_key = match secret(&ctx.env, "RESEND_API_KEY") {
        Ok(api_key) => api_key,
        Err(err) => return fail(now_ms, &err),
    };
    match resend::send(
        &api_key,
        &from,
        &request.to,
        &content.subject,
        &content.text,
        &content.html,
    )
    .await
    {
        Ok(id) => ok(now_ms, &serde_json::json!({"id": id})),
        Err(err) => fail(now_ms, &err),
    }
}

pub fn router() -> Router<'static, ()> {
    Router::new()
        .get_async("/health", health)
        .post_async("/send", send_email)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::{
        BrandInput, Content, SendRequest, authorized, resolve, status_of, valid_recipient,
    };
    use crate::resend::MailError;

    fn request(kind: &str) -> SendRequest {
        SendRequest {
            to: "user@example.com".to_string(),
            kind: kind.to_string(),
            code: Some("123456".to_string()),
            link: Some("https://id.neome.uk/v?token=abc".to_string()),
            title: Some("New login".to_string()),
            body: Some("A new login happened.".to_string()),
            locale: None,
            brand: None,
        }
    }

    fn content(request: &SendRequest) -> Content {
        match resolve(request) {
            Ok(content) => content,
            Err(err) => panic!("expected content, got {err:?}"),
        }
    }

    #[test]
    fn authorized_accepts_only_matching_key() {
        assert!(authorized(Some("key"), "key"));
        assert!(!authorized(Some("other"), "key"));
        assert!(!authorized(Some("key1"), "key2"));
        assert!(!authorized(None, "key"));
        assert!(!authorized(Some(""), ""));
        assert!(!authorized(Some("key"), ""));
        assert!(!authorized(Some(""), "key"));
    }

    #[test]
    fn recipients_require_an_address() {
        assert!(valid_recipient("user@example.com"));
        assert!(!valid_recipient(""));
        assert!(!valid_recipient("not-an-address"));
    }

    #[test]
    fn resolve_maps_every_kind() {
        let cases = [
            (
                "verify_code",
                "Neo ID verification code",
                "Your Neo ID verification code is: 123456",
                "confirm the action",
            ),
            (
                "login_code",
                "Neo ID login code",
                "Your Neo ID login code is: 123456",
                "Your login code",
            ),
            (
                "verify_email",
                "Verify your email — Neo ID",
                "Or open: https://id.neome.uk/v?token=abc",
                "Verify by link instead",
            ),
            (
                "reset_password",
                "Reset your password — Neo ID",
                "Click the link to reset your password",
                "expires in 15 minutes",
            ),
            (
                "security_notice",
                "New login",
                "A new login happened.",
                "secure your account immediately",
            ),
        ];
        for (kind, subject, text, html_marker) in cases {
            let resolved = content(&request(kind));
            assert_eq!(resolved.subject, subject, "{kind}");
            assert!(resolved.text.contains(text), "{kind}");
            assert!(resolved.html.contains(html_marker), "{kind}");
            assert!(resolved.html.contains("<!doctype html>"), "{kind}");
        }
    }

    #[test]
    fn resolve_rejects_missing_fields() {
        let mut missing_code = request("verify_code");
        missing_code.code = None;
        assert_eq!(resolve(&missing_code), Err(MailError::InvalidRequest));

        let mut empty_code = request("login_code");
        empty_code.code = Some(String::new());
        assert_eq!(resolve(&empty_code), Err(MailError::InvalidRequest));

        let mut missing_link = request("verify_email");
        missing_link.link = None;
        assert_eq!(resolve(&missing_link), Err(MailError::InvalidRequest));

        let mut missing_reset_link = request("reset_password");
        missing_reset_link.link = None;
        assert_eq!(resolve(&missing_reset_link), Err(MailError::InvalidRequest));

        let mut missing_title = request("security_notice");
        missing_title.title = None;
        assert_eq!(resolve(&missing_title), Err(MailError::InvalidRequest));

        let mut missing_body = request("security_notice");
        missing_body.body = None;
        assert_eq!(resolve(&missing_body), Err(MailError::InvalidRequest));
    }

    #[test]
    fn resolve_rejects_unknown_kind() {
        assert_eq!(resolve(&request("broadcast")), Err(MailError::UnknownKind));
    }

    #[test]
    fn status_table_pins_wire_codes() {
        let cases = [
            (
                MailError::Unauthorized,
                (401, "UNAUTHORIZED", "Invalid mail key"),
            ),
            (
                MailError::InvalidRequest,
                (400, "INVALID_REQUEST", "Malformed request"),
            ),
            (
                MailError::UnknownKind,
                (400, "UNKNOWN_KIND", "Unknown email kind"),
            ),
            (MailError::Internal, (500, "INTERNAL", "Internal error")),
        ];
        for (err, expected) in cases {
            assert_eq!(status_of(&err), expected);
        }
    }

    #[test]
    fn branded_request_uses_custom_brand() {
        let mut branded = request("login_code");
        branded.brand = Some(BrandInput {
            name: Some("MegaApp".to_string()),
            accent: Some("not-a-color".to_string()),
            logo_url: Some("http://insecure/logo.png".to_string()),
        });
        let resolved = content(&branded);
        assert_eq!(resolved.subject, "MegaApp login code");
        assert!(resolved.text.contains("MegaApp"));
        assert!(resolved.html.contains("MegaApp"));
        assert!(!resolved.html.contains("Neo ID"));
        assert!(!resolved.html.contains("http://insecure"));
    }

    #[test]
    fn locale_is_accepted_but_templates_stay_english() {
        let parsed: SendRequest = serde_json::from_value(json!({
            "to": "user@example.com",
            "kind": "verify_code",
            "code": "123456",
            "locale": "fr",
        }))
        .unwrap();
        assert_eq!(parsed.locale.as_deref(), Some("fr"));
        let resolved = content(&parsed);
        assert_eq!(resolved.subject, "Neo ID verification code");
    }
}
