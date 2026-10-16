use super::{Query, text};

#[must_use]
pub fn find_client(client_id: &str) -> Query {
    Query {
        sql: r#"SELECT "clientId","clientSecretHash","redirectUris","allowedScopes","grantTypes","isActive" FROM "service_apps" WHERE "clientId"=$1"#,
        params: vec![text(client_id)],
    }
}
