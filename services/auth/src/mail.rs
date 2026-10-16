use auth_core::AuthError;
use worker::{Fetch, Headers, Method, Request, RequestInit};

use super::routes::Ctx;

pub(crate) fn mailer(cx: &Ctx) -> Result<Mailer, AuthError> {
    Mailer::new(cx.app.mail_url.clone(), &cx.app.mail_key)
}

pub struct Mailer {
    url: String,
    key: String,
}

impl Mailer {
    pub fn new(url: Option<String>, key: &str) -> Result<Self, AuthError> {
        match url {
            Some(url) if !url.is_empty() && !key.is_empty() => Ok(Self {
                url,
                key: key.to_string(),
            }),
            _ => Err(AuthError::Internal),
        }
    }

    pub async fn send(
        &self,
        to: &str,
        kind: &str,
        code: Option<&str>,
        link: Option<&str>,
    ) -> std::result::Result<(), AuthError> {
        let headers = Headers::new();
        headers
            .set("content-type", "application/json")
            .map_err(|_| AuthError::Internal)?;
        headers
            .set("x-mail-key", &self.key)
            .map_err(|_| AuthError::Internal)?;
        let request = Request::new_with_init(
            &format!("{}/send", self.url),
            &RequestInit {
                method: Method::Post,
                headers,
                body: Some(
                    serde_json::json!({
                        "to": to, "kind": kind, "code": code, "link": link,
                    })
                    .to_string()
                    .into(),
                ),
                ..Default::default()
            },
        )
        .map_err(|_| AuthError::Internal)?;
        let mut response = Fetch::Request(request)
            .send()
            .await
            .map_err(|_| AuthError::Internal)?;
        if response.status_code() != 200 {
            return Err(AuthError::Internal);
        }
        let body: serde_json::Value = response.json().await.map_err(|_| AuthError::Internal)?;
        if body.get("ok").and_then(serde_json::Value::as_bool) == Some(true) {
            Ok(())
        } else {
            Err(AuthError::Internal)
        }
    }
}
