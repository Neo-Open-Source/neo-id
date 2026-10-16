use thiserror::Error;
use worker::{Fetch, Headers, Method, Request, RequestInit};

pub(crate) const ENDPOINT: &str = "https://api.resend.com/emails";

#[derive(Debug, Error, PartialEq, Eq)]
pub(crate) enum MailError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("invalid request")]
    InvalidRequest,
    #[error("unknown email kind")]
    UnknownKind,
    #[error("internal mail failure")]
    Internal,
}

#[must_use]
pub(crate) fn body(from: &str, to: &str, subject: &str, text: &str, html: &str) -> String {
    serde_json::json!({
        "from": from,
        "to": [to],
        "subject": subject,
        "text": text,
        "html": html,
    })
    .to_string()
}

#[must_use]
pub(crate) fn is_success(status: u16) -> bool {
    (200..300).contains(&status)
}

#[must_use]
pub(crate) fn response_id(raw: &str) -> Option<String> {
    serde_json::from_str::<serde_json::Value>(raw)
        .ok()?
        .get("id")?
        .as_str()
        .map(String::from)
}

pub(crate) async fn send(
    api_key: &str,
    from: &str,
    to: &str,
    subject: &str,
    text: &str,
    html: &str,
) -> Result<Option<String>, MailError> {
    let headers = Headers::new();
    headers
        .set("Authorization", &format!("Bearer {api_key}"))
        .map_err(|_| MailError::Internal)?;
    headers
        .set("Content-Type", "application/json")
        .map_err(|_| MailError::Internal)?;
    let mut init = RequestInit::new();
    init.with_method(Method::Post);
    init.with_headers(headers);
    init.with_body(Some(worker::wasm_bindgen::JsValue::from_str(&body(
        from, to, subject, text, html,
    ))));
    let request = Request::new_with_init(ENDPOINT, &init).map_err(|_| MailError::Internal)?;
    let mut response = Fetch::Request(request)
        .send()
        .await
        .map_err(|_| MailError::Internal)?;
    if !is_success(response.status_code()) {
        return Err(MailError::Internal);
    }
    let raw = response.text().await.map_err(|_| MailError::Internal)?;
    Ok(response_id(&raw))
}

#[cfg(test)]
mod tests {
    use super::{ENDPOINT, body, is_success, response_id};

    #[test]
    fn endpoint_matches_typescript_reference() {
        assert_eq!(ENDPOINT, "https://api.resend.com/emails");
    }

    #[test]
    fn request_body_matches_resend_shape() {
        let raw = body("from@example.com", "to@example.com", "s", "t", "<b>h</b>");
        let value: serde_json::Value = serde_json::from_str(&raw).unwrap();
        assert_eq!(
            value.get("from").and_then(|v| v.as_str()),
            Some("from@example.com")
        );
        assert_eq!(
            value.get("to").and_then(|v| v.as_array()).map(Vec::len),
            Some(1)
        );
        assert_eq!(
            value
                .get("to")
                .and_then(|v| v.as_array())
                .and_then(|a| a.first())
                .and_then(|v| v.as_str()),
            Some("to@example.com")
        );
        assert_eq!(value.get("subject").and_then(|v| v.as_str()), Some("s"));
        assert_eq!(value.get("text").and_then(|v| v.as_str()), Some("t"));
        assert_eq!(value.get("html").and_then(|v| v.as_str()), Some("<b>h</b>"));
    }

    #[test]
    fn success_covers_two_hundreds() {
        for status in [200, 201, 204, 299] {
            assert!(is_success(status), "{status}");
        }
        for status in [0, 199, 300, 400, 429, 500] {
            assert!(!is_success(status), "{status}");
        }
    }

    #[test]
    fn response_id_extracts_provider_id() {
        assert_eq!(response_id("{\"id\":\"abc\"}"), Some("abc".to_string()));
        assert_eq!(response_id("{}"), None);
        assert_eq!(response_id("not json"), None);
        assert_eq!(response_id("{\"id\":123}"), None);
    }
}
