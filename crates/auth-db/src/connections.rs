use super::{Query, instant, text};

#[must_use]
pub fn find_connection(user_id: &str, service_app_id: &str) -> Query {
    Query {
        sql: r#"SELECT "id","scopes",extract(epoch from "lastUsedAt")::bigint AS "lastUsedAt" FROM "authorized_connections" WHERE "userId"=$1 AND "serviceAppId"=$2"#,
        params: vec![text(user_id), text(service_app_id)],
    }
}

#[must_use]
pub fn upsert_connection(user_id: &str, service_app_id: &str, scopes: &[&str], now: u64) -> Query {
    Query {
        sql: r#"INSERT INTO "authorized_connections" ("id","userId","serviceAppId","scopes","lastUsedAt") VALUES (gen_random_uuid()::text,$1,$2,$3,to_timestamp($4)) ON CONFLICT ("userId","serviceAppId") DO UPDATE SET "scopes"=$3,"lastUsedAt"=to_timestamp($4)"#,
        params: vec![
            text(user_id),
            text(service_app_id),
            scopes_value(scopes),
            instant(now),
        ],
    }
}

fn scopes_value(scopes: &[&str]) -> serde_json::Value {
    serde_json::Value::Array(
        scopes
            .iter()
            .map(|scope| serde_json::Value::String((*scope).to_string()))
            .collect(),
    )
}

#[cfg(test)]
mod tests {
    use super::{find_connection, upsert_connection};

    #[test]
    fn builders_bind_every_placeholder() {
        for query in [
            find_connection("u1", "app-1"),
            upsert_connection("u1", "app-1", &["openid", "profile"], 1000),
        ] {
            let bound = (1..=8)
                .filter(|n| query.sql.contains(&format!("${n}")))
                .count();
            assert_eq!(bound, query.params.len(), "{}", query.sql);
        }
    }

    #[test]
    fn identifiers_are_quoted() {
        assert!(
            find_connection("u1", "app-1")
                .sql
                .contains(r#""authorized_connections""#)
        );
        assert!(
            upsert_connection("u1", "app-1", &[], 1)
                .sql
                .contains("ON CONFLICT")
        );
    }

    #[test]
    fn scopes_serialize_as_text_array() {
        let query = upsert_connection("u1", "app-1", &["openid"], 1);
        assert_eq!(query.params[2], serde_json::json!(["openid"]));
    }
}
