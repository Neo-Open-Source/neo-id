use super::{Query, text};

pub const OPAQUE_RECORDS_DDL: &str = r#"CREATE TABLE IF NOT EXISTS "opaque_records" ("user_id" TEXT PRIMARY KEY REFERENCES "users"("id") ON DELETE CASCADE, "envelope" TEXT NOT NULL)"#;

#[must_use]
pub fn upsert_envelope(user_id: &str, envelope_b64: &str) -> Query {
    Query {
        sql: r#"INSERT INTO "opaque_records" ("user_id","envelope") VALUES ($1,$2) ON CONFLICT ("user_id") DO UPDATE SET "envelope"=EXCLUDED."envelope""#,
        params: vec![text(user_id), text(envelope_b64)],
    }
}

#[must_use]
pub fn find_envelope(user_id: &str) -> Query {
    Query {
        sql: r#"SELECT "envelope" FROM "opaque_records" WHERE "user_id"=$1"#,
        params: vec![text(user_id)],
    }
}

#[must_use]
pub fn delete_envelope(user_id: &str) -> Query {
    Query {
        sql: r#"DELETE FROM "opaque_records" WHERE "user_id"=$1"#,
        params: vec![text(user_id)],
    }
}
