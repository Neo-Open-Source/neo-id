use super::{Query, text};

#[must_use]
pub fn find_identity(provider: &str, provider_user_id: &str) -> Query {
    Query {
        sql: r#"SELECT "userId" FROM "identities" WHERE "provider"=$1 AND "providerUserId"=$2"#,
        params: vec![text(provider), text(provider_user_id)],
    }
}

#[must_use]
pub fn insert_identity(id: &str, user_id: &str, provider: &str, provider_user_id: &str) -> Query {
    Query {
        sql: r#"INSERT INTO "identities" ("id","userId","provider","providerUserId") VALUES ($1,$2,$3,$4) ON CONFLICT DO NOTHING"#,
        params: vec![
            text(id),
            text(user_id),
            text(provider),
            text(provider_user_id),
        ],
    }
}
