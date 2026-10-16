use super::{Query, instant, nullable, text};

#[must_use]
pub fn issue_code(
    user_id: &str,
    purpose: &str,
    code: &str,
    target_email: Option<&str>,
    expires_at: u64,
) -> Query {
    Query {
        sql: r#"INSERT INTO "mfa_codes" ("id","userId","purpose","code","targetEmail","expiresAt") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,to_timestamp($5))"#,
        params: vec![
            text(user_id),
            text(purpose),
            text(code),
            nullable(target_email),
            instant(expires_at),
        ],
    }
}

#[must_use]
pub fn latest_valid(user_id: &str, purpose: &str, now: u64) -> Query {
    Query {
        sql: r#"SELECT "id","code",extract(epoch from "createdAt")::bigint AS "createdAt" FROM "mfa_codes" WHERE "userId"=$1 AND "purpose"=$2 AND "usedAt" IS NULL AND "expiresAt">to_timestamp($3) ORDER BY "createdAt" DESC LIMIT 1"#,
        params: vec![text(user_id), text(purpose), instant(now)],
    }
}

#[must_use]
pub fn mark_used(id: &str, now: u64) -> Query {
    Query {
        sql: r#"UPDATE "mfa_codes" SET "usedAt"=to_timestamp($2) WHERE "id"=$1"#,
        params: vec![text(id), instant(now)],
    }
}

#[must_use]
pub fn invalidate_pending(user_id: &str, purpose: &str, now: u64) -> Query {
    Query {
        sql: r#"UPDATE "mfa_codes" SET "usedAt"=to_timestamp($3) WHERE "userId"=$1 AND "purpose"=$2 AND "usedAt" IS NULL"#,
        params: vec![text(user_id), text(purpose), instant(now)],
    }
}
