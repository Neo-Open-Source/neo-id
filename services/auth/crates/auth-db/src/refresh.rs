use super::{Query, instant, nullable, text};

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
        sql: r#"INSERT INTO "refresh_tokens" ("id","userId","sessionId","tokenHash","parentId","deviceInfo","ipAddress","expiresAt") VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6,to_timestamp($7))"#,
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
