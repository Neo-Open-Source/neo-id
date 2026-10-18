use auth_core::{AuthError, generate_token, redirect_matches};
use auth_db::{Executor, create_code, find_client, find_connection};
use serde_json::Value;

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
    pub prompt: Option<String>,
    pub response_mode: Option<String>,
    pub max_age: Option<u64>,
    pub auth_time: Option<u64>,
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
    Granted {
        url: String,
        code: String,
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
    let Validated {
        scopes,
        service_app_id,
    } = match validate_request(&req, row) {
        Ok(validated) => validated,
        Err(Denied::Wire(err)) => return Err(err),
        Err(Denied::Redirect(outcome)) => return Ok(outcome),
    };
    let state = req.state.clone();
    let fresh = session_is_fresh(&req, now);
    let prompts: Vec<&str> = req
        .prompt
        .as_deref()
        .unwrap_or_default()
        .split_whitespace()
        .collect();
    match req.user_id {
        None => {
            if prompts.contains(&"none") {
                Ok(redirect_error(
                    &req.redirect_uri,
                    "login_required",
                    "Authentication is required",
                    state.as_deref(),
                ))
            } else {
                Ok(AuthorizeOutcome::Login { url: req.login_url })
            }
        }
        Some(user_id) => {
            if prompts.contains(&"login") || !fresh {
                if prompts.contains(&"none") {
                    return Ok(redirect_error(
                        &req.redirect_uri,
                        "login_required",
                        "Authentication is required",
                        state.as_deref(),
                    ));
                }
                return Ok(AuthorizeOutcome::Login { url: req.login_url });
            }
            if prompts.contains(&"none") {
                let consent = db.run(find_connection(&user_id, &service_app_id)).await?;
                if consent.is_empty() {
                    return Ok(redirect_error(
                        &req.redirect_uri,
                        "consent_required",
                        "Consent is required",
                        state.as_deref(),
                    ));
                }
                let (url, code) = issue_code(
                    db,
                    rng,
                    now,
                    CodeGrant {
                        service_app_id: &service_app_id,
                        user_id: &user_id,
                        session_id: req.session_id.as_deref(),
                        redirect_uri: &req.redirect_uri,
                        state: state.as_deref(),
                        code_challenge: req.code_challenge.as_deref(),
                    },
                )
                .await?;
                return Ok(AuthorizeOutcome::Granted {
                    url,
                    code,
                    nonce: req.nonce,
                    scopes,
                });
            }
            let state = state.unwrap_or_else(|| generate_token(rng, 16));
            Ok(AuthorizeOutcome::Consent {
                state,
                redirect_uri: req.redirect_uri,
                service_app_id,
                nonce: req.nonce,
                scopes,
            })
        }
    }
}

struct CodeGrant<'a> {
    service_app_id: &'a str,
    user_id: &'a str,
    session_id: Option<&'a str>,
    redirect_uri: &'a str,
    state: Option<&'a str>,
    code_challenge: Option<&'a str>,
}

struct Validated {
    scopes: Vec<String>,
    service_app_id: String,
}

enum Denied {
    Wire(WireError),
    Redirect(AuthorizeOutcome),
}

impl From<WireError> for Denied {
    fn from(err: WireError) -> Self {
        Self::Wire(err)
    }
}

fn redirect_error(
    redirect_uri: &str,
    error: &str,
    description: &str,
    state: Option<&str>,
) -> AuthorizeOutcome {
    AuthorizeOutcome::Error {
        url: error_url(redirect_uri, error, description, state),
    }
}

fn session_is_fresh(req: &AuthorizeRequest, now: u64) -> bool {
    match req.max_age {
        None => true,
        Some(max_age) => req
            .auth_time
            .is_some_and(|auth_time| now.saturating_sub(auth_time) <= max_age),
    }
}

fn validate_request(req: &AuthorizeRequest, row: &Value) -> Result<Validated, Denied> {
    let state = req.state.as_deref();
    if req.response_type.is_empty() {
        return Err(Denied::Redirect(redirect_error(
            &req.redirect_uri,
            WireError::InvalidRequest.as_str(),
            "Missing response_type",
            state,
        )));
    }
    if req.response_type != "code" {
        return Err(Denied::Redirect(redirect_error(
            &req.redirect_uri,
            WireError::UnsupportedResponseType.as_str(),
            "Only the authorization code flow is supported",
            state,
        )));
    }
    let requested: Vec<&str> = req.scope.split_whitespace().collect();
    let allowed = string_list(row, "allowedScopes").unwrap_or_default();
    if requested
        .iter()
        .any(|scope| !allowed.iter().any(|entry| entry == scope))
    {
        return Err(Denied::Redirect(redirect_error(
            &req.redirect_uri,
            WireError::InvalidScope.as_str(),
            "Requested scope is not allowed for this client",
            state,
        )));
    }
    if !requested.is_empty() && !requested.contains(&"openid") {
        return Err(Denied::Redirect(redirect_error(
            &req.redirect_uri,
            WireError::InvalidScope.as_str(),
            "The openid scope is required",
            state,
        )));
    }
    if let Some(mode) = req.response_mode.as_deref().filter(|mode| !mode.is_empty()) {
        if mode != "query" {
            return Err(Denied::Redirect(redirect_error(
                &req.redirect_uri,
                WireError::InvalidRequest.as_str(),
                "Unsupported response_mode",
                state,
            )));
        }
    }
    let service_app_id = app_id(row)?;
    let scopes = if requested.is_empty() {
        allowed
    } else {
        requested.iter().map(|scope| (*scope).to_string()).collect()
    };
    Ok(Validated {
        scopes,
        service_app_id,
    })
}

async fn issue_code<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    grant: CodeGrant<'_>,
) -> Result<(String, String), WireError> {
    let code = generate_token(rng, 32);
    let state = grant
        .state
        .map_or_else(|| generate_token(rng, 16), String::from);
    db.run(create_code(
        &code,
        &state,
        grant.service_app_id,
        grant.redirect_uri,
        grant.code_challenge,
        grant.session_id,
        grant.user_id,
        auth_core::authcode_expiry(now),
    ))
    .await?;
    Ok((approve_url(grant.redirect_uri, &code, grant.state), code))
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
            let (url, code) = issue_code(
                db,
                rng,
                now,
                CodeGrant {
                    service_app_id: &req.service_app_id,
                    user_id: &req.user_id,
                    session_id: req.session_id.as_deref(),
                    redirect_uri: &req.redirect_uri,
                    state: req.state.as_deref(),
                    code_challenge: req.code_challenge.as_deref(),
                },
            )
            .await?;
            Ok(Redirect {
                url,
                code: Some(code),
            })
        }
    }
}

pub(crate) fn app_id(row: &Value) -> Result<String, WireError> {
    row.get("id")
        .and_then(Value::as_str)
        .or_else(|| row.get("clientId").and_then(Value::as_str))
        .map(str::to_string)
        .ok_or(WireError::ServerError)
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

fn push_param(url: &mut String, key: &str, value: &str) {
    url.push(if url.contains('?') { '&' } else { '?' });
    url.push_str(key);
    url.push('=');
    url.push_str(&auth_core::percent_encode(value));
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
