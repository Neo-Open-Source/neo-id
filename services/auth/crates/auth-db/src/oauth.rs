use super::{Query, instant, nullable, text};

#[must_use]
pub fn create_code(
    code: &str,
    service_app_id: &str,
    redirect_uri: &str,
    challenge: Option<&str>,
    session_id: Option<&str>,
    user_id: &str,
    expires_at: u64,
) -> Query {
    Query {
        sql: r#"INSERT INTO "oauth_states" ("id","code","serviceAppId","redirectUri","mode","codeChallenge","sessionId","userId","expiresAt") VALUES (gen_random_uuid(),$1,$2,$3,'authorize',$4,$5,$6,to_timestamp($7))"#,
        params: vec![
            text(code),
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
