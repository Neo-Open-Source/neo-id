use super::{Query, instant, nullable, text, text_array};

#[must_use]
pub fn find_client(client_id: &str) -> Query {
    Query {
        sql: r#"SELECT "clientId","clientSecretHash","redirectUris","allowedScopes","grantTypes","isActive" FROM "service_apps" WHERE "clientId"=$1"#,
        params: vec![text(client_id)],
    }
}

#[allow(
    clippy::too_many_arguments,
    reason = "positional builder mirrors the eleven-column INSERT; a struct would split one row across two definitions"
)]
#[must_use]
pub fn create_client(
    owner_id: &str,
    client_id: &str,
    secret_hash: Option<&str>,
    name: &str,
    redirect_uris: &[String],
    scopes: &[String],
    grant_types: &[String],
    now: u64,
) -> Query {
    Query {
        sql: r#"INSERT INTO "service_apps" ("id","ownerId","clientId","clientSecretHash","name","redirectUris","allowedScopes","grantTypes","isActive","createdAt","updatedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,$4,$5,$6,$7,true,to_timestamp($8),to_timestamp($8))"#,
        params: vec![
            text(owner_id),
            text(client_id),
            nullable(secret_hash),
            text(name),
            text_array(&refs(redirect_uris)),
            text_array(&refs(scopes)),
            text_array(&refs(grant_types)),
            instant(now),
        ],
    }
}

fn refs(values: &[String]) -> Vec<&str> {
    values.iter().map(String::as_str).collect()
}

#[cfg(test)]
mod tests {
    use super::{create_client, find_client};

    #[test]
    fn create_client_binds_every_placeholder() {
        let query = create_client(
            "owner-1",
            "client-1",
            Some("hash"),
            "App",
            &["https://app/cb".to_string()],
            &["openid".to_string()],
            &["authorization_code".to_string()],
            1000,
        );
        let bound = (1..=8)
            .filter(|n| query.sql.contains(&format!("${n}")))
            .count();
        assert_eq!(bound, query.params.len());
        assert!(query.sql.contains(r#""service_apps""#));
        assert_eq!(query.params[4], serde_json::json!(["https://app/cb"]));
    }

    #[test]
    fn find_client_selects_by_client_id() {
        assert!(find_client("c1").sql.contains(r#""clientId"=$1"#));
    }
}
