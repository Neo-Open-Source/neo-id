use super::{Query, instant, nullable, text};
use auth_core::AuthError;
use auth_proto::auth::v1::RefreshToken;

#[must_use]
pub fn find_refresh(token_hash: &str) -> Query {
    Query {
        sql: r#"SELECT r."id",r."userId",r."sessionId",extract(epoch from r."expiresAt")::bigint AS "expiresAt",extract(epoch from r."revokedAt")::bigint AS "revokedAt",r."revokeReason",u."status" FROM "refresh_tokens" r JOIN "users" u ON u."id"=r."userId" WHERE r."tokenHash"=$1"#,
        params: vec![text(token_hash)],
    }
}

#[must_use]
pub fn create_refresh(
    user_id: &str,
    session_id: &str,
    token_hash: &str,
    parent_id: Option<&str>,
    device: Option<&str>,
    ip: Option<&str>,
    expires_at: u64,
) -> Query {
    Query {
        sql: r#"INSERT INTO "refresh_tokens" ("id","userId","sessionId","tokenHash","parentId","deviceInfo","ipAddress","expiresAt") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,to_timestamp($7))"#,
        params: vec![
            text(user_id),
            text(session_id),
            text(token_hash),
            nullable(parent_id),
            nullable(device),
            nullable(ip),
            instant(expires_at),
        ],
    }
}

#[must_use]
pub fn revoke_refresh(id: &str, reason: &str, now: u64) -> Query {
    Query {
        sql: r#"UPDATE "refresh_tokens" SET "revokedAt"=to_timestamp($2),"revokeReason"=$3 WHERE "id"=$1"#,
        params: vec![text(id), instant(now), text(reason)],
    }
}

#[must_use]
pub fn revoke_session_refreshes(session_id: &str, reason: &str, now: u64) -> Query {
    Query {
        sql: r#"UPDATE "refresh_tokens" SET "revokedAt"=to_timestamp($2),"revokeReason"=$3 WHERE "sessionId"=$1 AND "revokedAt" IS NULL"#,
        params: vec![text(session_id), instant(now), text(reason)],
    }
}

#[must_use]
pub fn revoke_user_refreshes(user_id: &str, reason: &str, now: u64) -> Query {
    Query {
        sql: r#"UPDATE "refresh_tokens" SET "revokedAt"=to_timestamp($2),"revokeReason"=$3 WHERE "userId"=$1 AND "revokedAt" IS NULL"#,
        params: vec![text(user_id), instant(now), text(reason)],
    }
}

fn required<'a>(row: &'a serde_json::Value, key: &str) -> Result<&'a str, AuthError> {
    row.get(key)
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)
}

fn epoch(row: &serde_json::Value, key: &str) -> Result<i64, AuthError> {
    row.get(key)
        .and_then(serde_json::Value::as_u64)
        .and_then(|secs| i64::try_from(secs).ok())
        .ok_or(AuthError::MalformedMessage)
}

pub fn parse_refresh(
    row: &serde_json::Value,
    session_active: bool,
) -> Result<RefreshToken, AuthError> {
    let session_id = row
        .get("sessionId")
        .and_then(serde_json::Value::as_str)
        .map(String::from);
    Ok(RefreshToken {
        user_id: required(row, "userId")?.to_string(),
        session_id: session_id.clone(),
        expires_at_unix: epoch(row, "expiresAt")?,
        revoked_at_unix: row
            .get("revokedAt")
            .and_then(serde_json::Value::as_u64)
            .map(|secs| i64::try_from(secs).unwrap_or(0)),
        revoke_reason: row
            .get("revokeReason")
            .and_then(serde_json::Value::as_str)
            .map(String::from),
        user_banned: required(row, "status").map(|status| status == "banned")?,
        session_active,
        has_session: session_id.is_some(),
    })
}
