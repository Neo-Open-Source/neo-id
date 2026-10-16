use super::{Query, instant, nullable, text};

#[must_use]
pub fn create_session(
    user_id: &str,
    device: Option<&str>,
    ip: Option<&str>,
    expires_at: u64,
) -> Query {
    Query {
        sql: r#"INSERT INTO "sessions" ("id","userId","deviceInfo","ipAddress","expiresAt") VALUES (gen_random_uuid()::text,$1,$2,$3,to_timestamp($4)) RETURNING "id""#,
        params: vec![
            text(user_id),
            nullable(device),
            nullable(ip),
            instant(expires_at),
        ],
    }
}

#[must_use]
pub fn find_session(id: &str) -> Query {
    Query {
        sql: r#"SELECT "id","userId","isActive",extract(epoch from "expiresAt")::bigint AS "expiresAt" FROM "sessions" WHERE "id"=$1"#,
        params: vec![text(id)],
    }
}

#[must_use]
pub fn touch_session(id: &str, device: Option<&str>, ip: Option<&str>, expires_at: u64) -> Query {
    Query {
        sql: r#"UPDATE "sessions" SET "lastActiveAt"=now(),"deviceInfo"=COALESCE($2,"deviceInfo"),"ipAddress"=COALESCE($3,"ipAddress"),"expiresAt"=to_timestamp($4) WHERE "id"=$1"#,
        params: vec![
            text(id),
            nullable(device),
            nullable(ip),
            instant(expires_at),
        ],
    }
}

#[must_use]
pub fn deactivate_session(id: &str) -> Query {
    Query {
        sql: r#"UPDATE "sessions" SET "isActive"=false WHERE "id"=$1"#,
        params: vec![text(id)],
    }
}

#[must_use]
pub fn deactivate_user_sessions(user_id: &str) -> Query {
    Query {
        sql: r#"UPDATE "sessions" SET "isActive"=false WHERE "userId"=$1 AND "isActive"=true"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn sessions_by_user(user_id: &str) -> Query {
    Query {
        sql: r#"SELECT "id","deviceInfo","ipAddress","location","isActive","lastActiveAt",extract(epoch from "expiresAt")::bigint AS "expiresAt" FROM "sessions" WHERE "userId"=$1 ORDER BY "lastActiveAt" DESC"#,
        params: vec![text(user_id)],
    }
}
