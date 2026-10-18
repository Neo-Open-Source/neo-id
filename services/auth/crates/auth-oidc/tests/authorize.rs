use auth_core::AuthError;
use auth_db::{Executor, Query};
use auth_oidc::{
    AuthorizeOutcome, AuthorizeRequest, ClientRegistered, ConsentChoice, ConsentRequest,
    RegisterRequest, WireError, authorize, decide_consent, register,
};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use serde_json::{Value, json};
use std::sync::Mutex;

const NOW: u64 = 1_800_000_000;
const CLIENT_ID: &str = "web-app";
const APP_ID: &str = "app-1";
const REDIRECT: &str = "https://app.example/cb";

struct State {
    clients: Vec<Value>,
    codes: Vec<Value>,
    connections: Vec<Value>,
    calls: Vec<String>,
}

struct MockDb {
    state: Mutex<State>,
}

impl MockDb {
    fn with_clients(clients: Vec<Value>) -> Self {
        Self {
            state: Mutex::new(State {
                clients,
                codes: Vec::new(),
                connections: Vec::new(),
                calls: Vec::new(),
            }),
        }
    }

    fn handle(&self, query: &Query) -> Result<Vec<Value>, AuthError> {
        let mut state = self.state.lock().map_err(|_| AuthError::Internal)?;
        state.calls.push(query.sql.to_string());
        if query.sql.contains("FROM \"service_apps\"") {
            let want = query
                .params
                .first()
                .and_then(Value::as_str)
                .unwrap_or_default();
            let rows: Vec<Value> = state
                .clients
                .iter()
                .filter(|row| row.get("clientId").and_then(Value::as_str) == Some(want))
                .cloned()
                .collect();
            return Ok(rows);
        }
        if query.sql.contains("FROM \"authorized_connections\"") {
            return Ok(state.connections.clone());
        }
        if query.sql.contains("INSERT INTO \"oauth_states\"") {
            state.codes.push(json!({
                "code": query.params[0],
                "state": query.params[1],
                "serviceAppId": query.params[2],
                "redirectUri": query.params[3],
                "codeChallenge": query.params[4],
                "sessionId": query.params[5],
                "userId": query.params[6],
            }));
            return Ok(Vec::new());
        }
        Ok(Vec::new())
    }

    fn codes(&self) -> Vec<Value> {
        self.state
            .lock()
            .map(|state| state.codes.clone())
            .unwrap_or_default()
    }

    fn calls(&self) -> Vec<String> {
        self.state
            .lock()
            .map(|state| state.calls.clone())
            .unwrap_or_default()
    }
}

impl Executor for MockDb {
    fn run(
        &self,
        query: Query,
    ) -> impl std::future::Future<Output = Result<Vec<Value>, AuthError>> {
        let result = self.handle(&query);
        async move { result }
    }
}

fn client(active: bool, redirects: &[&str]) -> Value {
    json!({
        "id": APP_ID,
        "clientId": CLIENT_ID,
        "clientSecretHash": Value::Null,
        "redirectUris": redirects,
        "allowedScopes": ["openid", "profile", "email"],
        "grantTypes": ["authorization_code", "refresh_token"],
        "isActive": active,
    })
}

fn authorize_req() -> AuthorizeRequest {
    AuthorizeRequest {
        response_type: "code".to_string(),
        client_id: CLIENT_ID.to_string(),
        redirect_uri: REDIRECT.to_string(),
        scope: "openid profile email".to_string(),
        state: Some("s-1".to_string()),
        nonce: None,
        prompt: None,
        response_mode: None,
        code_challenge: None,
        code_challenge_method: None,
        user_id: Some("u-1".to_string()),
        session_id: Some("sess-1".to_string()),
        login_url: "https://id.example/auth".to_string(),
    }
}

fn consent_req(choice: ConsentChoice) -> ConsentRequest {
    ConsentRequest {
        choice,
        service_app_id: APP_ID.to_string(),
        user_id: "u-1".to_string(),
        session_id: Some("sess-9".to_string()),
        redirect_uri: REDIRECT.to_string(),
        state: Some("s-7".to_string()),
        code_challenge: Some("challenge-1".to_string()),
    }
}

async fn outcome(db: &MockDb, req: AuthorizeRequest) -> Result<AuthorizeOutcome, WireError> {
    authorize(db, &mut ChaCha8Rng::seed_from_u64(3), NOW, req).await
}

#[tokio::test]
async fn consent_for_signed_in_user() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let result = outcome(&db, authorize_req()).await.unwrap();
    assert_eq!(
        result,
        AuthorizeOutcome::Consent {
            state: "s-1".to_string(),
            redirect_uri: REDIRECT.to_string(),
            service_app_id: APP_ID.to_string(),
            nonce: None,
            scopes: vec![
                "openid".to_string(),
                "profile".to_string(),
                "email".to_string(),
            ],
        }
    );
}

#[tokio::test]
async fn login_redirect_for_anonymous_user() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        user_id: None,
        ..authorize_req()
    };
    let result = outcome(&db, req).await.unwrap();
    assert_eq!(
        result,
        AuthorizeOutcome::Login {
            url: "https://id.example/auth".to_string()
        }
    );
}

#[tokio::test]
async fn trailing_slash_redirect_still_matches() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        redirect_uri: format!("{REDIRECT}/"),
        ..authorize_req()
    };
    assert!(matches!(
        outcome(&db, req).await,
        Ok(AuthorizeOutcome::Consent { .. })
    ));
}

#[tokio::test]
async fn unknown_client_is_invalid_client() {
    let db = MockDb::with_clients(vec![]);
    let result = outcome(&db, authorize_req()).await;
    assert_eq!(result, Err(WireError::InvalidClient));
}

#[tokio::test]
async fn redirect_mismatch_is_invalid_request() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        redirect_uri: "https://evil.example/cb".to_string(),
        ..authorize_req()
    };
    assert_eq!(outcome(&db, req).await, Err(WireError::InvalidRequest));
}

#[tokio::test]
async fn disabled_client_is_access_denied() {
    let db = MockDb::with_clients(vec![client(false, &[REDIRECT])]);
    assert_eq!(
        outcome(&db, authorize_req()).await,
        Err(WireError::AccessDenied)
    );
}

#[tokio::test]
async fn unsupported_response_type_redirects_error() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        response_type: "token".to_string(),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => {
            assert!(url.contains("error=unsupported_response_type"));
            assert!(url.contains("state=s-1"));
        }
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn missing_fields_are_invalid_request() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    for req in [
        AuthorizeRequest {
            client_id: String::new(),
            ..authorize_req()
        },
        AuthorizeRequest {
            redirect_uri: String::new(),
            ..authorize_req()
        },
    ] {
        assert_eq!(outcome(&db, req).await, Err(WireError::InvalidRequest));
    }
}

#[tokio::test]
async fn missing_response_type_redirects_invalid_request() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        response_type: String::new(),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => {
            assert!(url.contains("error=invalid_request"));
        }
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn state_is_generated_when_missing() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        state: None,
        ..authorize_req()
    };
    let result = outcome(&db, req).await.unwrap();
    assert!(matches!(result, AuthorizeOutcome::Consent { .. }));
    if let AuthorizeOutcome::Consent { state, .. } = result {
        assert_ne!(state, "");
    }
}

#[tokio::test]
async fn consent_echoes_nonce_and_service_app_id() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        nonce: Some("n-9".to_string()),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Consent {
            nonce,
            service_app_id,
            ..
        } => {
            assert_eq!(nonce.as_deref(), Some("n-9"));
            assert_eq!(service_app_id, APP_ID);
        }
        other => panic!("expected consent, got {other:?}"),
    }
}

#[tokio::test]
async fn scope_without_openid_redirects_invalid_scope() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        scope: "profile email".to_string(),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => {
            assert!(url.contains("error=invalid_scope"));
        }
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn disallowed_scope_redirects_invalid_scope() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        scope: "openid admin".to_string(),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => {
            assert!(url.contains("error=invalid_scope"));
        }
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn granted_scopes_are_echoed() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        scope: "openid email".to_string(),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Consent { scopes, .. } => {
            assert_eq!(scopes, vec!["openid".to_string(), "email".to_string()]);
        }
        other => panic!("expected consent, got {other:?}"),
    }
}

#[tokio::test]
async fn prompt_none_without_session_is_login_required() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        user_id: None,
        prompt: Some("none".to_string()),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => assert!(url.contains("error=login_required")),
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn prompt_login_forces_login() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        prompt: Some("login".to_string()),
        ..authorize_req()
    };
    assert!(matches!(
        outcome(&db, req).await.unwrap(),
        AuthorizeOutcome::Login { .. }
    ));
}

#[tokio::test]
async fn prompt_none_without_consent_is_consent_required() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        prompt: Some("none".to_string()),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => assert!(url.contains("error=consent_required")),
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn prompt_none_with_prior_consent_grants_code() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    db.state
        .lock()
        .unwrap()
        .connections
        .push(json!({"id": "conn-1"}));
    let req = AuthorizeRequest {
        prompt: Some("none".to_string()),
        nonce: Some("n-1".to_string()),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Granted { url, code, nonce } => {
            assert!(url.contains("code="));
            assert_ne!(code, "");
            assert_eq!(nonce.as_deref(), Some("n-1"));
        }
        other => panic!("expected granted, got {other:?}"),
    }
}

#[tokio::test]
async fn response_mode_fragment_is_invalid_request() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = AuthorizeRequest {
        response_mode: Some("fragment".to_string()),
        ..authorize_req()
    };
    match outcome(&db, req).await.unwrap() {
        AuthorizeOutcome::Error { url } => assert!(url.contains("error=invalid_request")),
        other => panic!("expected error redirect, got {other:?}"),
    }
}

#[tokio::test]
async fn approve_creates_code_and_redirects_with_state() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let result = decide_consent(
        &db,
        &mut ChaCha8Rng::seed_from_u64(11),
        NOW,
        consent_req(ConsentChoice::Approved),
    )
    .await
    .unwrap();
    assert!(result.url.starts_with(REDIRECT));
    assert!(result.url.contains("code="));
    assert!(result.url.contains("state=s-7"));
    assert!(result.code.is_some());
    let codes = db.codes();
    assert_eq!(codes.len(), 1);
    assert_eq!(codes[0].get("state").and_then(Value::as_str), Some("s-7"));
    assert_eq!(codes[0].get("userId").and_then(Value::as_str), Some("u-1"));
    assert_eq!(
        codes[0].get("sessionId").and_then(Value::as_str),
        Some("sess-9")
    );
    assert_eq!(
        codes[0].get("codeChallenge").and_then(Value::as_str),
        Some("challenge-1")
    );
}

#[tokio::test]
async fn approve_without_state_omits_state_param() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let req = ConsentRequest {
        state: None,
        ..consent_req(ConsentChoice::Approved)
    };
    let result = decide_consent(&db, &mut ChaCha8Rng::seed_from_u64(12), NOW, req)
        .await
        .unwrap();
    assert!(result.url.contains("code="));
    assert!(!result.url.contains("state="));
}

#[tokio::test]
async fn deny_redirects_without_touching_db() {
    let db = MockDb::with_clients(vec![client(true, &[REDIRECT])]);
    let result = decide_consent(
        &db,
        &mut ChaCha8Rng::seed_from_u64(13),
        NOW,
        consent_req(ConsentChoice::Denied),
    )
    .await
    .unwrap();
    assert!(result.url.contains("error=access_denied"));
    assert!(
        result
            .url
            .contains("error_description=User%20denied%20access")
    );
    assert!(result.url.contains("state=s-7"));
    assert_eq!(db.codes(), Vec::<Value>::new());
    assert_eq!(db.calls(), Vec::<String>::new());
}

#[test]
fn wire_codes_match_oauth_strings() {
    for (error, wire) in [
        (WireError::InvalidRequest, "invalid_request"),
        (WireError::InvalidClient, "invalid_client"),
        (WireError::InvalidGrant, "invalid_grant"),
        (WireError::UnauthorizedClient, "unauthorized_client"),
        (WireError::UnsupportedGrantType, "unsupported_grant_type"),
        (WireError::UnsupportedResponseType, "unsupported_response_type"),
        (WireError::InvalidScope, "invalid_scope"),
        (WireError::AccessDenied, "access_denied"),
        (WireError::ServerError, "server_error"),
    ] {
        assert_eq!(error.as_str(), wire);
        assert_eq!(error.to_string(), wire);
    }
}

async fn registered(req: RegisterRequest) -> Result<ClientRegistered, WireError> {
    register(
        &MockDb::with_clients(vec![]),
        &mut ChaCha8Rng::seed_from_u64(21),
        NOW,
        req,
    )
    .await
}

fn register_req(redirects: &[&str]) -> RegisterRequest {
    RegisterRequest {
        owner_id: "owner-1".to_string(),
        redirect_uris: redirects.iter().map(ToString::to_string).collect(),
        client_name: Some("Example".to_string()),
    }
}

#[tokio::test]
async fn register_mints_credentials_and_trims_uris() {
    let result = registered(register_req(&["  https://app.example/cb/  "]))
        .await
        .unwrap();
    assert_ne!(result.client_id, "");
    assert_ne!(result.client_secret, "");
    assert_eq!(
        result.client_secret_hash,
        auth_core::hash_token(&result.client_secret)
    );
    assert_eq!(
        result.redirect_uris,
        vec!["https://app.example/cb/".to_string()]
    );
    let debug = format!("{result:?}");
    assert!(!debug.contains(&result.client_secret));
    assert!(!debug.contains(&result.client_secret_hash));
}

#[tokio::test]
async fn register_persists_client_row() {
    let db = MockDb::with_clients(vec![]);
    let result = register(
        &db,
        &mut ChaCha8Rng::seed_from_u64(21),
        NOW,
        register_req(&["https://app.example/cb"]),
    )
    .await
    .unwrap();
    assert_eq!(result.created_at, NOW);
    assert!(
        db.calls()
            .iter()
            .any(|sql| sql.contains(r#"INSERT INTO "service_apps""#))
    );
}

#[tokio::test]
async fn register_rejects_missing_or_malformed_uris() {
    for req in [
        register_req(&[]),
        register_req(&["   "]),
        register_req(&["not-a-uri"]),
        register_req(&["https://ok.example/cb", "has space://x"]),
    ] {
        assert_eq!(registered(req).await, Err(WireError::InvalidRequest));
    }
}
