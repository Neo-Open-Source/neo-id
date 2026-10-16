use super::{Query, instant, nullable, text};

#[allow(
    clippy::too_many_arguments,
    reason = "positional builder mirrors the ten-column INSERT; a struct would split one row across two definitions"
)]
#[must_use]
pub fn create_code(
    code: &str,
    state: &str,
    service_app_id: &str,
    redirect_uri: &str,
    challenge: Option<&str>,
    session_id: Option<&str>,
    user_id: &str,
    expires_at: u64,
) -> Query {
    Query {
        sql: r#"INSERT INTO "oauth_states" ("id","code","state","serviceAppId","redirectUri","mode","codeChallenge","sessionId","userId","expiresAt") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,'authorize',$5,$6,$7,to_timestamp($8))"#,
        params: vec![
            text(code),
            text(state),
            text(service_app_id),
            text(redirect_uri),
            nullable(challenge),
            nullable(session_id),
            text(user_id),
            instant(expires_at),
        ],
    }
}

#[must_use]
pub fn find_code(code: &str, service_app_id: &str, redirect_uri: &str, now: u64) -> Query {
    Query {
        sql: r#"SELECT "code","serviceAppId","redirectUri","codeChallenge","codeVerifier","sessionId","userId" FROM "oauth_states" WHERE "code"=$1 AND "serviceAppId"=$2 AND "redirectUri"=$3 AND "mode"='authorize' AND "expiresAt">to_timestamp($4)"#,
        params: vec![
            text(code),
            text(service_app_id),
            text(redirect_uri),
            instant(now),
        ],
    }
}

#[must_use]
pub fn delete_code(code: &str) -> Query {
    Query {
        sql: r#"DELETE FROM "oauth_states" WHERE "code"=$1"#,
        params: vec![text(code)],
    }
}
