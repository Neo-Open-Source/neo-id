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

#[must_use]
pub fn create_user(email: &str, now: u64) -> Query {
    Query {
        sql: r#"INSERT INTO "users" ("id","email","createdAt","updatedAt") VALUES (gen_random_uuid()::text,$1,to_timestamp($2),to_timestamp($2)) RETURNING "id""#,
        params: vec![text(email), instant(now)],
    }
}

#[must_use]
pub fn totp_secret(user_id: &str) -> Query {
    Query {
        sql: r#"SELECT "totpSecret" FROM "users" WHERE "id"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn set_totp_secret(user_id: &str, secret_b64: &str) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "totpSecret"=$2 WHERE "id"=$1"#,
        params: vec![text(user_id), text(secret_b64)],
    }
}

#[must_use]
pub fn enable_totp(user_id: &str) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "totpEnabled"=true WHERE "id"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn disable_totp(user_id: &str) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "totpEnabled"=false,"totpSecret"=NULL WHERE "id"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn set_email_verified(user_id: &str) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "emailVerified"=true WHERE "id"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn update_profile(
    user_id: &str,
    display_name: Option<&str>,
    first_name: Option<&str>,
    last_name: Option<&str>,
) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "displayName"=COALESCE($2,"displayName"),"firstName"=COALESCE($3,"firstName"),"lastName"=COALESCE($4,"lastName") WHERE "id"=$1"#,
        params: vec![
            text(user_id),
            nullable(display_name),
            nullable(first_name),
            nullable(last_name),
        ],
    }
}

#[must_use]
pub fn set_email(user_id: &str, email: &str) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "email"=$2,"emailVerified"=false WHERE "id"=$1"#,
        params: vec![text(user_id), text(email)],
    }
}

#[must_use]
pub fn set_reset_token(user_id: &str, token_hash: &str, expires_at: u64) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "userMetadata"=COALESCE("userMetadata",'{}'::jsonb)||jsonb_build_object('passwordResetToken',$2,'passwordResetExpires',to_char(to_timestamp($3),'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) WHERE "id"=$1"#,
        params: vec![text(user_id), text(token_hash), instant(expires_at)],
    }
}

#[must_use]
pub fn clear_reset_token(user_id: &str) -> Query {
    Query {
        sql: r#"UPDATE "users" SET "userMetadata"=COALESCE("userMetadata",'{}'::jsonb)-'passwordResetToken'-'passwordResetExpires' WHERE "id"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn find_by_reset_hash(token_hash: &str, now: u64) -> Query {
    Query {
        sql: r#"SELECT "id","email" FROM "users" WHERE "userMetadata"->>'passwordResetToken'=$1 AND ("userMetadata"->>'passwordResetExpires')::timestamptz>to_timestamp($2)"#,
        params: vec![text(token_hash), instant(now)],
    }
}
