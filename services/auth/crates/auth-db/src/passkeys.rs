use super::{Query, nullable, text};

pub const PASSKEYS_BACKUP_COLUMNS_DDL: &str = r#"ALTER TABLE "passkeys" ADD COLUMN IF NOT EXISTS "backupEligible" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN IF NOT EXISTS "backupState" BOOLEAN NOT NULL DEFAULT false"#;

#[must_use]
pub fn insert_passkey(
    user_id: &str,
    credential_id_b64: &str,
    public_key_b64: &str,
    transports_json: Option<&str>,
    backup_eligible: bool,
    backup_state: bool,
) -> Query {
    Query {
        sql: r#"INSERT INTO "passkeys" ("id","userId","credentialId","publicKey","transports","backupEligible","backupState") VALUES (gen_random_uuid(),$1,$2,$3,$4,$5,$6)"#,
        params: vec![
            text(user_id),
            text(credential_id_b64),
            text(public_key_b64),
            nullable(transports_json),
            serde_json::Value::Bool(backup_eligible),
            serde_json::Value::Bool(backup_state),
        ],
    }
}

#[must_use]
pub fn passkeys_by_user(user_id: &str) -> Query {
    Query {
        sql: r#"SELECT "credentialId","publicKey","counter","transports" FROM "passkeys" WHERE "userId"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn update_counter(credential_id_b64: &str, counter: u32) -> Query {
    Query {
        sql: r#"UPDATE "passkeys" SET "counter"=$2,"lastUsedAt"=now() WHERE "credentialId"=$1"#,
        params: vec![
            text(credential_id_b64),
            serde_json::Value::Number(counter.into()),
        ],
    }
}

#[must_use]
pub fn delete_passkey(credential_id_b64: &str, user_id: &str) -> Query {
    Query {
        sql: r#"DELETE FROM "passkeys" WHERE "credentialId"=$1 AND "userId"=$2"#,
        params: vec![text(credential_id_b64), text(user_id)],
    }
}
