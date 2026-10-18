use auth_core::{AuthError, generate_token, redirect_matches};
use auth_db::{Executor, create_code, find_client};
use serde_json::Value;
use std::fmt::Write as _;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WireError {
    InvalidRequest,
    InvalidClient,
    InvalidGrant,
    UnauthorizedClient,
    UnsupportedGrantType,
    UnsupportedResponseType,
    InvalidScope,
    AccessDenied,
    ServerError,
}

impl WireError {
    #[must_use]
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::InvalidRequest => "invalid_request",
            Self::InvalidClient => "invalid_client",
            Self::InvalidGrant => "invalid_grant",
            Self::UnauthorizedClient => "unauthorized_client",
            Self::UnsupportedGrantType => "unsupported_grant_type",
            Self::UnsupportedResponseType => "unsupported_response_type",
            Self::InvalidScope => "invalid_scope",
            Self::AccessDenied => "access_denied",
            Self::ServerError => "server_error",
        }
    }
}

impl core::fmt::Display for WireError {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        formatter.write_str(self.as_str())
    }
}

impl std::error::Error for WireError {}

impl From<AuthError> for WireError {
    fn from(err: AuthError) -> Self {
        match err {
            AuthError::MalformedMessage => Self::InvalidRequest,
            AuthError::InvalidCredentials => Self::InvalidGrant,
            AuthError::Internal => Self::ServerError,
        }
    }
}

#[derive(Debug, Clone)]
pub struct AuthorizeRequest {
    pub response_type: String,
    pub client_id: String,
    pub redirect_uri: String,
    pub scope: String,
    pub state: Option<String>,
    pub nonce: Option<String>,
    pub code_challenge: Option<String>,
    pub code_challenge_method: Option<String>,
    pub user_id: Option<String>,
    pub session_id: Option<String>,
    pub login_url: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthorizeOutcome {
    Login {
        url: String,
    },
    Consent {
        state: String,
        redirect_uri: String,
        service_app_id: String,
        nonce: Option<String>,
        scopes: Vec<String>,
    },
    Error {
        url: String,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConsentChoice {
    Approved,
    Denied,
}

#[derive(Debug, Clone)]
pub struct ConsentRequest {
    pub choice: ConsentChoice,
    pub service_app_id: String,
    pub user_id: String,
    pub session_id: Option<String>,
    pub redirect_uri: String,
    pub state: Option<String>,
    pub code_challenge: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Redirect {
    pub url: String,
    pub code: Option<String>,
}

pub async fn authorize<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    req: AuthorizeRequest,
) -> Result<AuthorizeOutcome, WireError> {
    let _ = now;
    if req.client_id.is_empty() || req.redirect_uri.is_empty() {
        return Err(WireError::InvalidRequest);
    }
    let rows = db.run(find_client(&req.client_id)).await?;
    let row = rows.first().ok_or(WireError::InvalidClient)?;
    if !flag(row, "isActive")? {
        return Err(WireError::AccessDenied);
    }
    let registered = string_list(row, "redirectUris")?;
    let refs: Vec<&str> = registered.iter().map(String::as_str).collect();
    if !redirect_matches(&refs, &req.redirect_uri) {
        return Err(WireError::InvalidRequest);
    }
    let state = req.state.clone();
    if req.response_type.is_empty() {
        return Ok(AuthorizeOutcome::Error {
            url: error_url(
                &req.redirect_uri,
                WireError::InvalidRequest.as_str(),
                "Missing response_type",
                state.as_deref(),
            ),
        });
    }
    if req.response_type != "code" {
        return Ok(AuthorizeOutcome::Error {
            url: error_url(
                &req.redirect_uri,
                WireError::UnsupportedResponseType.as_str(),
                "Only the authorization code flow is supported",
                state.as_deref(),
            ),
        });
    }
    let requested: Vec<&str> = req.scope.split_whitespace().collect();
    let allowed = string_list(row, "allowedScopes").unwrap_or_default();
    if requested.iter().any(|scope| !allowed.iter().any(|entry| entry == scope)) {
        return Ok(AuthorizeOutcome::Error {
            url: error_url(
                &req.redirect_uri,
                WireError::InvalidScope.as_str(),
                "Requested scope is not allowed for this client",
                state.as_deref(),
            ),
        });
    }
    if !requested.is_empty() && !requested.contains(&"openid") {
        return Ok(AuthorizeOutcome::Error {
            url: error_url(
                &req.redirect_uri,
                WireError::InvalidScope.as_str(),
                "The openid scope is required",
                state.as_deref(),
            ),
        });
    }
    let scopes: Vec<String> = if requested.is_empty() {
        allowed
    } else {
        requested.iter().map(|scope| (*scope).to_string()).collect()
    };
    let state = req.state.unwrap_or_else(|| generate_token(rng, 16));
    match req.user_id {
        None => Ok(AuthorizeOutcome::Login { url: req.login_url }),
        Some(_) => Ok(AuthorizeOutcome::Consent {
            state,
            redirect_uri: req.redirect_uri,
            service_app_id: row
                .get("id")
                .and_then(Value::as_str)
                .or_else(|| row.get("clientId").and_then(Value::as_str))
                .ok_or(WireError::InvalidClient)?
                .to_string(),
            nonce: req.nonce,
            scopes,
        }),
    }
}

pub async fn decide_consent<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    req: ConsentRequest,
) -> Result<Redirect, WireError> {
    match req.choice {
        ConsentChoice::Denied => Ok(Redirect {
            url: deny_url(&req.redirect_uri, req.state.as_deref()),
            code: None,
        }),
        ConsentChoice::Approved => {
            let code = generate_token(rng, 32);
            let state = req.state.clone().unwrap_or_else(|| generate_token(rng, 16));
            db.run(create_code(
                &code,
                &state,
                &req.service_app_id,
                &req.redirect_uri,
                req.code_challenge.as_deref(),
                req.session_id.as_deref(),
                &req.user_id,
                auth_core::authcode_expiry(now),
            ))
            .await?;
            Ok(Redirect {
                url: approve_url(&req.redirect_uri, &code, req.state.as_deref()),
                code: Some(code),
            })
        }
    }
}

pub(crate) fn field<'a>(row: &'a Value, key: &str) -> Result<&'a str, WireError> {
    row.get(key)
        .and_then(Value::as_str)
        .ok_or(WireError::ServerError)
}

pub(crate) fn optional(row: &Value, key: &str) -> Option<String> {
    row.get(key).and_then(Value::as_str).map(str::to_string)
}

pub(crate) fn flag(row: &Value, key: &str) -> Result<bool, WireError> {
    row.get(key)
        .and_then(Value::as_bool)
        .ok_or(WireError::ServerError)
}

pub(crate) fn epoch(row: &Value, key: &str) -> Result<u64, WireError> {
    row.get(key)
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_i64().and_then(|n| u64::try_from(n).ok()))
        })
        .ok_or(WireError::ServerError)
}

pub(crate) fn string_list(row: &Value, key: &str) -> Result<Vec<String>, WireError> {
    row.get(key)
        .and_then(Value::as_array)
        .map(|items| {
            items
                .iter()
                .filter_map(Value::as_str)
                .map(str::to_string)
                .collect()
        })
        .ok_or(WireError::ServerError)
}

fn encode(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for byte in value.bytes() {
        match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                out.push(char::from(byte));
            }
            _ => {
                out.push('%');
                let _ = write!(out, "{byte:02X}");
            }
        }
    }
    out
}

fn push_param(url: &mut String, key: &str, value: &str) {
    url.push(if url.contains('?') { '&' } else { '?' });
    url.push_str(key);
    url.push('=');
    url.push_str(&encode(value));
}

fn approve_url(base: &str, code: &str, state: Option<&str>) -> String {
    let mut url = base.to_string();
    push_param(&mut url, "code", code);
    if let Some(state) = state.filter(|state| !state.is_empty()) {
        push_param(&mut url, "state", state);
    }
    url
}

fn error_url(base: &str, error: &str, description: &str, state: Option<&str>) -> String {
    let mut url = base.to_string();
    push_param(&mut url, "error", error);
    push_param(&mut url, "error_description", description);
    if let Some(state) = state.filter(|state| !state.is_empty()) {
        push_param(&mut url, "state", state);
    }
    url
}

fn deny_url(base: &str, state: Option<&str>) -> String {
    error_url(base, "access_denied", "User denied access", state)
}
