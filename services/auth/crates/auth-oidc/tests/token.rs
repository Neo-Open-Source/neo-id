use auth_core::{AuthError, hash_token, pkce_challenge, verify_access};
use auth_db::{Executor, Query};
use auth_oidc::{
    Grant, LogoutRequest, TokenRequest, Tokens, UserInfoRequest, WireError, logout, token, userinfo,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use serde_json::{Value, json};
use std::sync::Mutex;

const NOW: u64 = 1_800_000_000;
const ISSUER: &str = "https://id.neome.uk";
const PRIVATE_PEM: &str = include_str!("data/test-rsa.pem");
const PUBLIC_PEM: &str = include_str!("data/test-rsa.pub.pem");
const CLIENT_ID: &str = "web-app";
const APP_ID: &str = "app-1";
const REDIRECT: &str = "https://app.example/cb";
const SECRET: &str = "topsecret";
const VERIFIER: &str = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
const USER_ID: &str = "u-1";
const SESSION_ID: &str = "sess-1";

struct State {
    clients: Vec<Value>,
    codes: Vec<Value>,
    users: Vec<Value>,
    sessions: Vec<Value>,
    refreshes: Vec<Value>,
    calls: Vec<String>,
}

struct MockDb {
    state: Mutex<State>,
}

impl MockDb {
    fn handle(&self, query: &Query) -> Result<Vec<Value>, AuthError> {
        let mut state = self.state.lock().map_err(|_| AuthError::Internal)?;
        state.calls.push(query.sql.to_string());
        if let Some(rows) = Self::select(&state, query) {
            return Ok(rows);
        }
        Ok(Self::apply(&mut state, query))
    }

    fn select(state: &State, query: &Query) -> Option<Vec<Value>> {
        let sql = query.sql;
        if !sql.starts_with("SELECT") {
            return None;
        }
        if sql.contains("FROM \"service_apps\"") {
            return Some(filter(&state.clients, "clientId", &text_param(query, 0)));
        }
        if sql.contains("FROM \"oauth_states\"") {
            let (code, app, redirect, now) = (
                text_param(query, 0),
                text_param(query, 1),
                text_param(query, 2),
                num_param(query, 3),
            );
            let rows: Vec<Value> = state
                .codes
                .iter()
                .filter(|row| {
                    str_field(row, "code") == code
                        && str_field(row, "serviceAppId") == app
                        && str_field(row, "redirectUri") == redirect
                        && num_field(row, "expiresAt") > now
                })
                .cloned()
                .collect();
            return Some(rows);
        }
        if sql.contains("FROM \"users\"") {
            return Some(filter(&state.users, "id", &text_param(query, 0)));
        }
        if sql.contains("FROM \"sessions\"") {
            return Some(filter(&state.sessions, "id", &text_param(query, 0)));
        }
        if sql.contains("FROM \"refresh_tokens\"") {
            return Some(filter(&state.refreshes, "tokenHash", &text_param(query, 0)));
        }
        None
    }

    fn apply(state: &mut State, query: &Query) -> Vec<Value> {
        let sql = query.sql;
        if sql.contains("DELETE FROM \"oauth_states\"") {
            let want = text_param(query, 0);
            state.codes.retain(|row| str_field(row, "code") != want);
        } else if sql.contains("INSERT INTO \"sessions\"") {
            let id = format!("sess-new-{}", state.sessions.len());
            state.sessions.push(json!({
                "id": id,
                "userId": query.params[0],
                "isActive": true,
                "expiresAt": query.params[3],
            }));
            return vec![json!({ "id": id })];
        } else if sql.contains("UPDATE \"sessions\" SET \"lastActiveAt\"") {
            Self::touch_session(state, query);
        } else if sql.contains("UPDATE \"sessions\" SET \"isActive\"=false WHERE \"id\"") {
            let want = text_param(query, 0);
            for row in &mut state.sessions {
                if str_field(row, "id") == want {
                    row["isActive"] = json!(false);
                }
            }
        } else if sql.contains("UPDATE \"sessions\" SET \"isActive\"=false WHERE \"userId\"") {
            let want = text_param(query, 0);
            for row in state
                .sessions
                .iter_mut()
                .filter(|row| str_field(row, "userId") == want)
            {
                row["isActive"] = json!(false);
            }
        } else if sql.contains("INSERT INTO \"refresh_tokens\"") {
            let id = format!("rt-new-{}", state.refreshes.len());
            state.refreshes.push(json!({
                "id": id,
                "userId": query.params[0],
                "sessionId": query.params[1],
                "tokenHash": query.params[2],
                "parentId": query.params[3],
                "expiresAt": query.params[6],
                "revokedAt": Value::Null,
                "revokeReason": Value::Null,
                "status": "active",
            }));
        } else if sql.contains("UPDATE \"refresh_tokens\"") {
            let (want, at, reason) = (
                text_param(query, 0),
                num_param(query, 1),
                text_param(query, 2),
            );
            for row in &mut state.refreshes {
                if str_field(row, "id") == want {
                    row["revokedAt"] = json!(at);
                    row["revokeReason"] = json!(reason);
                }
            }
        }
        Vec::new()
    }

    fn touch_session(state: &mut State, query: &Query) {
        let (want, expires) = (text_param(query, 0), num_param(query, 3));
        for row in &mut state.sessions {
            if str_field(row, "id") == want {
                row["expiresAt"] = json!(expires);
            }
        }
    }

    fn calls(&self) -> Vec<String> {
        self.state
            .lock()
            .map(|state| state.calls.clone())
            .unwrap_or_default()
    }

    fn refreshes(&self) -> Vec<Value> {
        self.state
            .lock()
            .map(|state| state.refreshes.clone())
            .unwrap_or_default()
    }

    fn session_active(&self, id: &str) -> bool {
        let Ok(state) = self.state.lock() else {
            return false;
        };
        state
            .sessions
            .iter()
            .any(|row| str_field(row, "id") == id && row["isActive"] == json!(true))
    }

    fn updates_of(&self, marker: &str) -> usize {
        self.calls()
            .iter()
            .filter(|sql| sql.contains(marker))
            .count()
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

fn str_field(row: &Value, key: &str) -> String {
    row.get(key)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn num_field(row: &Value, key: &str) -> u64 {
    row.get(key)
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_i64().and_then(|n| u64::try_from(n).ok()))
        })
        .unwrap_or_default()
}

fn filter(rows: &[Value], key: &str, want: &str) -> Vec<Value> {
    rows.iter()
        .filter(|row| row.get(key).and_then(Value::as_str) == Some(want))
        .cloned()
        .collect()
}

fn text_param(query: &Query, index: usize) -> String {
    query
        .params
        .get(index)
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string()
}

fn num_param(query: &Query, index: usize) -> u64 {
    query
        .params
        .get(index)
        .and_then(|value| {
            value
                .as_u64()
                .or_else(|| value.as_i64().and_then(|n| u64::try_from(n).ok()))
        })
        .unwrap_or_default()
}

fn client_row(secret_hash: Option<&str>, active: bool) -> Value {
    json!({
        "id": APP_ID,
        "clientId": CLIENT_ID,
        "clientSecretHash": secret_hash,
        "redirectUris": [REDIRECT],
        "allowedScopes": ["openid", "profile", "email"],
        "grantTypes": ["authorization_code", "refresh_token"],
        "isActive": active,
    })
}

fn public_client_row() -> Value {
    json!({
        "id": "app-spa",
        "clientId": "spa",
        "clientSecretHash": Value::Null,
        "redirectUris": [REDIRECT],
        "allowedScopes": ["openid"],
        "grantTypes": ["authorization_code"],
        "isActive": true,
    })
}

struct CodeSpec<'a> {
    code: &'a str,
    app: &'a str,
    redirect: &'a str,
    challenge: Option<&'a str>,
    legacy: Option<&'a str>,
    session: Option<&'a str>,
    user: &'a str,
    expires: u64,
}

fn code_row(spec: &CodeSpec<'_>) -> Value {
    json!({
        "code": spec.code,
        "serviceAppId": spec.app,
        "redirectUri": spec.redirect,
        "codeChallenge": spec.challenge,
        "codeVerifier": spec.legacy,
        "sessionId": spec.session,
        "userId": spec.user,
        "expiresAt": spec.expires,
    })
}

fn user_row(status: &str) -> Value {
    json!({
        "id": USER_ID,
        "email": "alice@example.com",
        "role": "user",
        "status": status,
        "emailVerified": true,
        "displayName": "Alice",
        "firstName": "Alice",
        "lastName": "Liddell",
        "avatar": "https://cdn.example/a.png",
    })
}

fn session_row(id: &str, active: bool, expires: u64) -> Value {
    json!({ "id": id, "userId": USER_ID, "isActive": active, "expiresAt": expires })
}

fn refresh_row(
    id: &str,
    hash: &str,
    session: Option<&str>,
    expires: u64,
    revoked: Option<u64>,
    reason: Option<&str>,
    status: &str,
) -> Value {
    json!({
        "id": id,
        "tokenHash": hash,
        "userId": USER_ID,
        "sessionId": session,
        "expiresAt": expires,
        "revokedAt": revoked,
        "revokeReason": reason,
        "status": status,
    })
}

fn harness() -> (MockDb, ChaCha8Rng) {
    let db = MockDb {
        state: Mutex::new(State {
            clients: vec![client_row(Some(&hash_token(SECRET)), true)],
            codes: vec![code_row(&CodeSpec {
                code: "authcode-1",
                app: APP_ID,
                redirect: REDIRECT,
                challenge: Some(&pkce_challenge(VERIFIER)),
                legacy: None,
                session: Some(SESSION_ID),
                user: USER_ID,
                expires: NOW + 600,
            })],
            users: vec![user_row("active")],
            sessions: vec![session_row(SESSION_ID, true, NOW + 1_000)],
            refreshes: vec![refresh_row(
                "rt-1",
                &hash_token("refresh-1"),
                Some(SESSION_ID),
                NOW + 1_000,
                None,
                None,
                "active",
            )],
            calls: Vec::new(),
        }),
    };
    (db, ChaCha8Rng::seed_from_u64(7))
}

fn code_grant(code: &str, verifier: Option<&str>, secret: Option<&str>) -> TokenRequest {
    TokenRequest {
        grant: Grant::Code {
            code: code.to_string(),
            redirect_uri: REDIRECT.to_string(),
            client_id: CLIENT_ID.to_string(),
            client_secret: secret.map(str::to_string),
            code_verifier: verifier.map(str::to_string),
            nonce: None,
        },
        device: Some("test-browser".to_string()),
        ip: Some("10.0.0.1".to_string()),
    }
}

fn refresh_grant(raw: &str) -> TokenRequest {
    TokenRequest {
        grant: Grant::Refresh {
            refresh_token: raw.to_string(),
            client_id: CLIENT_ID.to_string(),
            client_secret: Some(SECRET.to_string()),
        },
        device: None,
        ip: None,
    }
}

async fn exchange(
    db: &MockDb,
    rng: &mut ChaCha8Rng,
    req: TokenRequest,
) -> Result<Tokens, WireError> {
    token(db, rng, NOW, PRIVATE_PEM.as_bytes(), ISSUER, req).await
}

fn id_payload(id_token: &str) -> Value {
    let part = id_token.split('.').nth(1).unwrap_or_default();
    let bytes = URL_SAFE_NO_PAD.decode(part).unwrap_or_default();
    serde_json::from_slice(&bytes).unwrap_or(Value::Null)
}

#[tokio::test]
async fn code_flow_issues_bearer_set() {
    let (db, mut rng) = harness();
    let tokens = exchange(
        &db,
        &mut rng,
        code_grant("authcode-1", Some(VERIFIER), Some(SECRET)),
    )
    .await
    .unwrap();
    assert_eq!(tokens.expires_in, 900);
    assert_eq!(tokens.session_id, SESSION_ID);
    let claims = verify_access(
        PUBLIC_PEM.as_bytes(),
        &tokens.access_token,
        ISSUER,
        NOW + 10,
    )
    .unwrap();
    assert_eq!(claims.sub, USER_ID);
    assert_eq!(claims.session_id.as_deref(), Some(SESSION_ID));
    assert_eq!(id_payload(&tokens.id_token)["aud"], json!(CLIENT_ID));
    let stored: Vec<Value> = db
        .refreshes()
        .into_iter()
        .filter(|row| str_field(row, "tokenHash") == hash_token(&tokens.refresh_token))
        .collect();
    assert_eq!(stored.len(), 1);
    let debug = format!("{tokens:?}");
    assert!(!debug.contains(&tokens.refresh_token));
}

#[tokio::test]
async fn id_token_reflects_nonce_and_access_token_hash() {
    let (db, mut rng) = harness();
    let mut req = code_grant("authcode-1", Some(VERIFIER), Some(SECRET));
    if let Grant::Code { nonce, .. } = &mut req.grant {
        *nonce = Some("nonce-abc".to_string());
    }
    let tokens = exchange(&db, &mut rng, req).await.unwrap();
    let payload = id_payload(&tokens.id_token);
    assert_eq!(payload["nonce"], json!("nonce-abc"));
    assert_eq!(
        payload["at_hash"],
        json!(auth_core::at_hash(&tokens.access_token))
    );
}

#[tokio::test]
async fn code_flow_mints_session_when_none_bound() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.codes.push(code_row(&CodeSpec {
            code: "authcode-9",
            app: APP_ID,
            redirect: REDIRECT,
            challenge: Some(&pkce_challenge(VERIFIER)),
            legacy: None,
            session: None,
            user: USER_ID,
            expires: NOW + 600,
        }));
    }
    let tokens = exchange(
        &db,
        &mut rng,
        code_grant("authcode-9", Some(VERIFIER), Some(SECRET)),
    )
    .await
    .unwrap();
    assert!(tokens.session_id.starts_with("sess-new-"));
}

#[tokio::test]
async fn authorization_code_is_single_use() {
    let (db, mut rng) = harness();
    let req = || code_grant("authcode-1", Some(VERIFIER), Some(SECRET));
    exchange(&db, &mut rng, req()).await.unwrap();
    assert_eq!(
        exchange(&db, &mut rng, req()).await,
        Err(WireError::InvalidGrant)
    );
}

#[tokio::test]
async fn unknown_or_disabled_client_or_bad_secret_is_invalid_client() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.clients = vec![client_row(Some(&hash_token(SECRET)), false)];
    }
    assert_eq!(
        exchange(
            &db,
            &mut rng,
            code_grant("authcode-1", Some(VERIFIER), Some(SECRET))
        )
        .await,
        Err(WireError::InvalidClient)
    );
    {
        let mut state = db.state.lock().unwrap();
        state.clients = vec![];
    }
    assert_eq!(
        exchange(
            &db,
            &mut rng,
            code_grant("authcode-1", Some(VERIFIER), Some(SECRET))
        )
        .await,
        Err(WireError::InvalidClient)
    );
    {
        let mut state = db.state.lock().unwrap();
        state.clients = vec![client_row(Some(&hash_token(SECRET)), true)];
    }
    assert_eq!(
        exchange(
            &db,
            &mut rng,
            code_grant("authcode-1", Some(VERIFIER), Some("wrong"))
        )
        .await,
        Err(WireError::InvalidClient)
    );
}

#[tokio::test]
async fn redirect_mismatch_or_expired_code_is_invalid_grant() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.codes.push(code_row(&CodeSpec {
            code: "authcode-old",
            app: APP_ID,
            redirect: REDIRECT,
            challenge: Some(&pkce_challenge(VERIFIER)),
            legacy: None,
            session: Some(SESSION_ID),
            user: USER_ID,
            expires: NOW - 1,
        }));
    }
    let expired = TokenRequest {
        grant: Grant::Code {
            code: "authcode-old".to_string(),
            redirect_uri: REDIRECT.to_string(),
            client_id: CLIENT_ID.to_string(),
            client_secret: Some(SECRET.to_string()),
            code_verifier: Some(VERIFIER.to_string()),
            nonce: None,
        },
        device: None,
        ip: None,
    };
    assert_eq!(
        exchange(&db, &mut rng, expired).await,
        Err(WireError::InvalidGrant)
    );
    let mismatch = TokenRequest {
        grant: Grant::Code {
            code: "authcode-1".to_string(),
            redirect_uri: "https://evil.example/cb".to_string(),
            client_id: CLIENT_ID.to_string(),
            client_secret: Some(SECRET.to_string()),
            code_verifier: Some(VERIFIER.to_string()),
            nonce: None,
        },
        device: None,
        ip: None,
    };
    assert_eq!(
        exchange(&db, &mut rng, mismatch).await,
        Err(WireError::InvalidGrant)
    );
}

#[tokio::test]
async fn wrong_or_missing_verifier_is_invalid_grant() {
    let (db, mut rng) = harness();
    assert_eq!(
        exchange(
            &db,
            &mut rng,
            code_grant("authcode-1", Some("wrong"), Some(SECRET))
        )
        .await,
        Err(WireError::InvalidGrant)
    );
    assert_eq!(
        exchange(&db, &mut rng, code_grant("authcode-1", None, Some(SECRET))).await,
        Err(WireError::InvalidGrant)
    );
}

#[tokio::test]
async fn legacy_challenge_column_still_verifies() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.codes.push(code_row(&CodeSpec {
            code: "authcode-legacy",
            app: APP_ID,
            redirect: REDIRECT,
            challenge: None,
            legacy: Some(&pkce_challenge(VERIFIER)),
            session: Some(SESSION_ID),
            user: USER_ID,
            expires: NOW + 600,
        }));
    }
    let tokens = exchange(
        &db,
        &mut rng,
        code_grant("authcode-legacy", Some(VERIFIER), Some(SECRET)),
    )
    .await
    .unwrap();
    assert_eq!(tokens.session_id, SESSION_ID);
}

#[tokio::test]
async fn public_client_without_pkce_is_invalid_grant() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.clients.push(public_client_row());
        state.codes.push(code_row(&CodeSpec {
            code: "authcode-spa",
            app: "app-spa",
            redirect: REDIRECT,
            challenge: None,
            legacy: None,
            session: Some(SESSION_ID),
            user: USER_ID,
            expires: NOW + 600,
        }));
        state.codes.push(code_row(&CodeSpec {
            code: "authcode-spa-pkce",
            app: "app-spa",
            redirect: REDIRECT,
            challenge: Some(&pkce_challenge(VERIFIER)),
            legacy: None,
            session: Some(SESSION_ID),
            user: USER_ID,
            expires: NOW + 600,
        }));
    }
    let bare = TokenRequest {
        grant: Grant::Code {
            code: "authcode-spa".to_string(),
            redirect_uri: REDIRECT.to_string(),
            client_id: "spa".to_string(),
            client_secret: None,
            code_verifier: None,
            nonce: None,
        },
        device: None,
        ip: None,
    };
    assert_eq!(
        exchange(&db, &mut rng, bare).await,
        Err(WireError::InvalidGrant)
    );
    let proven = TokenRequest {
        grant: Grant::Code {
            code: "authcode-spa-pkce".to_string(),
            redirect_uri: REDIRECT.to_string(),
            client_id: "spa".to_string(),
            client_secret: None,
            code_verifier: Some(VERIFIER.to_string()),
            nonce: None,
        },
        device: None,
        ip: None,
    };
    let tokens = exchange(&db, &mut rng, proven).await.unwrap();
    assert_eq!(id_payload(&tokens.id_token)["aud"], json!("spa"));
}

#[tokio::test]
async fn banned_user_is_access_denied() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.users = vec![user_row("banned")];
    }
    assert_eq!(
        exchange(
            &db,
            &mut rng,
            code_grant("authcode-1", Some(VERIFIER), Some(SECRET))
        )
        .await,
        Err(WireError::AccessDenied)
    );
    assert_eq!(
        exchange(&db, &mut rng, refresh_grant("refresh-1")).await,
        Err(WireError::AccessDenied)
    );
}

#[tokio::test]
async fn refresh_rotates_and_links_parent() {
    let (db, mut rng) = harness();
    let tokens = exchange(&db, &mut rng, refresh_grant("refresh-1"))
        .await
        .unwrap();
    assert_eq!(tokens.session_id, SESSION_ID);
    assert_eq!(tokens.expires_in, 900);
    assert_eq!(id_payload(&tokens.id_token)["aud"], json!(CLIENT_ID));
    let refreshed: Vec<Value> = db.refreshes();
    let old = refreshed
        .iter()
        .find(|row| str_field(row, "id") == "rt-1")
        .unwrap();
    assert_eq!(
        old.get("revokeReason").and_then(Value::as_str),
        Some("rotated")
    );
    let next = refreshed
        .iter()
        .find(|row| str_field(row, "tokenHash") == hash_token(&tokens.refresh_token))
        .unwrap();
    assert_eq!(next.get("parentId").and_then(Value::as_str), Some("rt-1"));
    assert_eq!(db.updates_of("UPDATE \"refresh_tokens\""), 1);
}

#[tokio::test]
async fn confidential_client_must_present_secret() {
    let (db, mut rng) = harness();
    assert_eq!(
        exchange(&db, &mut rng, code_grant("authcode-1", Some(VERIFIER), None)).await,
        Err(WireError::InvalidClient)
    );
    assert_eq!(
        exchange(
            &db,
            &mut rng,
            code_grant("authcode-1", Some(VERIFIER), Some("wrong"))
        )
        .await,
        Err(WireError::InvalidClient)
    );
    let mut req = refresh_grant("refresh-1");
    if let Grant::Refresh { client_secret, .. } = &mut req.grant {
        *client_secret = None;
    }
    assert_eq!(
        exchange(&db, &mut rng, req).await,
        Err(WireError::InvalidClient)
    );
}

#[tokio::test]
async fn public_client_refresh_needs_no_secret() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.clients = vec![json!({
            "id": APP_ID,
            "clientId": CLIENT_ID,
            "clientSecretHash": Value::Null,
            "redirectUris": [REDIRECT],
            "allowedScopes": ["openid"],
            "grantTypes": ["refresh_token"],
            "isActive": true,
        })];
    }
    let mut req = refresh_grant("refresh-1");
    if let Grant::Refresh { client_secret, .. } = &mut req.grant {
        *client_secret = None;
    }
    assert!(exchange(&db, &mut rng, req).await.is_ok());
}

#[tokio::test]
async fn rotated_token_replays_within_grace_window() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.refreshes.push(refresh_row(
            "rt-grace",
            &hash_token("refresh-grace"),
            Some(SESSION_ID),
            NOW + 1_000,
            Some(NOW - 10),
            Some("rotated"),
            "active",
        ));
    }
    let before = db.updates_of("UPDATE \"refresh_tokens\"");
    let tokens = exchange(&db, &mut rng, refresh_grant("refresh-grace"))
        .await
        .unwrap();
    assert_eq!(tokens.session_id, SESSION_ID);
    assert_eq!(db.updates_of("UPDATE \"refresh_tokens\""), before);
}

#[tokio::test]
async fn stale_or_expired_or_unknown_refresh_is_invalid_grant() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.refreshes.push(refresh_row(
            "rt-stale",
            &hash_token("refresh-stale"),
            Some(SESSION_ID),
            NOW + 1_000,
            Some(NOW - 61),
            Some("rotated"),
            "active",
        ));
        state.refreshes.push(refresh_row(
            "rt-old",
            &hash_token("refresh-old"),
            Some(SESSION_ID),
            NOW - 1,
            None,
            None,
            "active",
        ));
        state.refreshes.push(refresh_row(
            "rt-logout",
            &hash_token("refresh-logout"),
            Some(SESSION_ID),
            NOW + 1_000,
            Some(NOW - 5),
            Some("logout"),
            "active",
        ));
    }
    for raw in [
        "refresh-stale",
        "refresh-old",
        "refresh-logout",
        "refresh-unknown",
    ] {
        assert_eq!(
            exchange(&db, &mut rng, refresh_grant(raw)).await,
            Err(WireError::InvalidGrant),
            "{raw}"
        );
    }
}

#[tokio::test]
async fn refresh_without_live_session_fails_closed() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.refreshes.push(refresh_row(
            "rt-naked",
            &hash_token("refresh-naked"),
            None,
            NOW + 1_000,
            None,
            None,
            "active",
        ));
        state.refreshes.push(refresh_row(
            "rt-dead",
            &hash_token("refresh-dead"),
            Some("sess-dead"),
            NOW + 1_000,
            None,
            None,
            "active",
        ));
        state
            .sessions
            .push(session_row("sess-idle", false, NOW + 1_000));
        state.refreshes.push(refresh_row(
            "rt-idle",
            &hash_token("refresh-idle"),
            Some("sess-idle"),
            NOW + 1_000,
            None,
            None,
            "active",
        ));
    }
    assert_eq!(
        exchange(&db, &mut rng, refresh_grant("refresh-naked")).await,
        Err(WireError::InvalidRequest)
    );
    for raw in ["refresh-dead", "refresh-idle"] {
        assert_eq!(
            exchange(&db, &mut rng, refresh_grant(raw)).await,
            Err(WireError::InvalidGrant),
            "{raw}"
        );
    }
}

#[tokio::test]
async fn userinfo_returns_openid_profile() {
    let (db, mut rng) = harness();
    let profile = userinfo(
        &db,
        &mut rng,
        NOW,
        UserInfoRequest {
            sub: USER_ID.to_string(),
        },
    )
    .await
    .unwrap();
    assert_eq!(profile.sub, USER_ID);
    assert_eq!(profile.email, "alice@example.com");
    assert!(profile.email_verified);
    assert_eq!(profile.name, "Alice");
    assert_eq!(profile.given_name.as_deref(), Some("Alice"));
    assert_eq!(profile.family_name.as_deref(), Some("Liddell"));
    assert_eq!(
        profile.picture.as_deref(),
        Some("https://cdn.example/a.png")
    );
}

#[tokio::test]
async fn userinfo_unknown_or_banned() {
    let (db, mut rng) = harness();
    let missing = userinfo(
        &db,
        &mut rng,
        NOW,
        UserInfoRequest {
            sub: "ghost".to_string(),
        },
    )
    .await;
    assert_eq!(missing, Err(WireError::InvalidRequest));
    {
        let mut state = db.state.lock().unwrap();
        state.users = vec![user_row("banned")];
    }
    let banned = userinfo(
        &db,
        &mut rng,
        NOW,
        UserInfoRequest {
            sub: USER_ID.to_string(),
        },
    )
    .await;
    assert_eq!(banned, Err(WireError::AccessDenied));
}

#[tokio::test]
async fn logout_ends_session_or_user_or_nothing() {
    let (db, mut rng) = harness();
    let session = logout(
        &db,
        &mut rng,
        NOW,
        LogoutRequest {
            session_id: Some(SESSION_ID.to_string()),
            user_id: Some(USER_ID.to_string()),
            post_logout_redirect: None,
            state: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(session.redirect_url, "/");
    assert!(!db.session_active(SESSION_ID));

    let (db, mut rng) = harness();
    let user = logout(
        &db,
        &mut rng,
        NOW,
        LogoutRequest {
            session_id: None,
            user_id: Some(USER_ID.to_string()),
            post_logout_redirect: Some("https://app.example/bye".to_string()),
            state: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(user.redirect_url, "https://app.example/bye");
    assert!(!db.session_active(SESSION_ID));

    let (db, mut rng) = harness();
    let anonymous = logout(
        &db,
        &mut rng,
        NOW,
        LogoutRequest {
            session_id: None,
            user_id: None,
            post_logout_redirect: Some("  ".to_string()),
            state: None,
        },
    )
    .await
    .unwrap();
    assert_eq!(anonymous.redirect_url, "/");
    assert_eq!(db.calls(), Vec::<String>::new());
}

#[tokio::test]
async fn logout_appends_state_to_redirect() {
    let (db, mut rng) = harness();
    let done = logout(
        &db,
        &mut rng,
        NOW,
        LogoutRequest {
            session_id: Some(SESSION_ID.to_string()),
            user_id: None,
            post_logout_redirect: Some("https://app.example/bye?x=1".to_string()),
            state: Some("st ate".to_string()),
        },
    )
    .await
    .unwrap();
    assert_eq!(
        done.redirect_url,
        "https://app.example/bye?x=1&state=st%20ate"
    );
}

#[test]
fn debug_redacts_secrets() {
    use auth_oidc::ClientRegistered;
    let tokens = Tokens {
        access_token: "secret-access".to_string(),
        refresh_token: "secret-refresh".to_string(),
        id_token: "secret-id".to_string(),
        session_id: "sess-1".to_string(),
        expires_in: 900,
    };
    let rendered = format!("{tokens:?}");
    assert!(rendered.contains("Tokens"));
    assert!(rendered.contains("sess-1"));
    assert!(!rendered.contains("secret-access"));
    assert!(!rendered.contains("secret-refresh"));
    assert!(!rendered.contains("secret-id"));
    let registered = ClientRegistered {
        client_id: "client-1".to_string(),
        client_secret: "shhh".to_string(),
        client_secret_hash: "hash-of-shhh".to_string(),
        redirect_uris: vec!["https://app.example/cb".to_string()],
        created_at: 0,
    };
    let rendered = format!("{registered:?}");
    assert!(rendered.contains("client-1"));
    assert!(!rendered.contains("shhh"));
    assert!(!rendered.contains("hash-of-shhh"));
}

#[tokio::test]
async fn confidential_client_without_secret_is_rejected() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.codes.push(code_row(&CodeSpec {
            code: "authcode-2",
            app: APP_ID,
            redirect: REDIRECT,
            challenge: None,
            legacy: None,
            session: None,
            user: USER_ID,
            expires: NOW + 600,
        }));
    }
    let err = exchange(&db, &mut rng, code_grant("authcode-2", None, None)).await;
    assert!(matches!(err, Err(WireError::InvalidClient)));
}

#[tokio::test]
async fn banned_user_refresh_is_access_denied() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.refreshes.push(refresh_row(
            "rt-banned",
            &hash_token("refresh-banned"),
            Some(SESSION_ID),
            NOW + 1_000,
            None,
            None,
            "banned",
        ));
    }
    let err = exchange(&db, &mut rng, refresh_grant("refresh-banned")).await;
    assert!(matches!(err, Err(WireError::AccessDenied)));
}

#[tokio::test]
async fn stale_session_forces_new_session() {
    for (id, active, expires) in [("sess-old", true, NOW), ("sess-off", false, NOW + 1_000)] {
        let (db, mut rng) = harness();
        {
            let mut state = db.state.lock().unwrap();
            state.sessions.push(session_row(id, active, expires));
            state.codes.push(code_row(&CodeSpec {
                code: "authcode-3",
                app: APP_ID,
                redirect: REDIRECT,
                challenge: Some(&pkce_challenge(VERIFIER)),
                legacy: None,
                session: Some(id),
                user: USER_ID,
                expires: NOW + 600,
            }));
        }
        let tokens = exchange(
            &db,
            &mut rng,
            code_grant("authcode-3", Some(VERIFIER), Some(SECRET)),
        )
        .await
        .unwrap();
        assert_ne!(tokens.session_id, id);
    }
}

#[tokio::test]
async fn expired_session_marks_refresh_unusable() {
    let (db, mut rng) = harness();
    {
        let mut state = db.state.lock().unwrap();
        state.sessions[0]["expiresAt"] = serde_json::json!(NOW);
    }
    let err = exchange(&db, &mut rng, refresh_grant("refresh-1")).await;
    assert!(matches!(err, Err(WireError::InvalidGrant)));
}
