use super::{Query, instant, nullable, text};

#[must_use]
pub fn find_user_by_email(email: &str) -> Query {
    Query {
        sql: r#"SELECT id,email,role,status,"totpSecret","totpEnabled","emailMfaEnabled" FROM "users" WHERE "email"=$1"#,
        params: vec![text(email)],
    }
}

#[must_use]
pub fn find_user_by_id(id: &str) -> Query {
    Query {
        sql: r#"SELECT id,email,role,status FROM "users" WHERE "id"=$1"#,
        params: vec![text(id)],
    }
}

#[must_use]
pub fn touch_login(user_id: &str, ip: Option<&str>, now: u64) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "lastLoginAt"=to_timestamp($2),"lastLoginIp"=$3 WHERE "id"=$1"#,
        params: vec![text(user_id), instant(now), nullable(ip)],
    }
}
