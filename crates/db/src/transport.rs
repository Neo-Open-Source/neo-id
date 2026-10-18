use auth_core::AuthError;

pub fn http_endpoint(database_url: &str) -> Result<String, AuthError> {
    let after_scheme = database_url
        .split_once("://")
        .map_or(database_url, |(_, rest)| rest);
    let host = after_scheme
        .rsplit_once('@')
        .map_or(after_scheme, |(_, rest)| rest);
    let host = host.split(['/', '?']).next().unwrap_or_default();
    if host.is_empty() || !host.contains('.') {
        return Err(AuthError::MalformedMessage);
    }
    Ok(format!("https://{host}/sql"))
}

#[must_use]
pub fn query_body(sql: &str, params: &[serde_json::Value]) -> String {
    serde_json::json!({"query": sql, "params": params}).to_string()
}

pub fn rows(response_body: &str) -> Result<Vec<serde_json::Value>, AuthError> {
    let parsed: serde_json::Value =
        serde_json::from_str(response_body).map_err(|_| AuthError::MalformedMessage)?;
    match parsed.get("rows").and_then(|rows| rows.as_array()) {
        Some(rows) => Ok(rows.clone()),
        None => Err(AuthError::MalformedMessage),
    }
}

#[cfg(test)]
mod tests {
    use super::{http_endpoint, query_body, rows};

    #[test]
    fn http_endpoint_builds_neon_sql_url() {
        assert_eq!(
            http_endpoint("postgres://user:pass@ep-x.eu.neon.tech/db?sslmode=require").unwrap(),
            "https://ep-x.eu.neon.tech/sql"
        );
        assert!(http_endpoint("nonsense").is_err());
        assert!(http_endpoint("postgres://user@/db").is_err());
    }

    #[test]
    fn query_body_carries_sql_and_params() {
        let value: serde_json::Value =
            serde_json::from_str(&query_body("SELECT 1", &[serde_json::json!(1)])).unwrap();
        assert_eq!(value["query"], "SELECT 1");
        assert_eq!(value["params"], serde_json::json!([1]));
    }

    #[test]
    fn rows_extracts_only_successful_bodies() {
        assert_eq!(
            rows(r#"{"rows":[{"a":1}]}"#).unwrap(),
            vec![serde_json::json!({"a": 1})]
        );
        assert!(rows("{}").is_err());
        assert!(rows("not json").is_err());
    }
}
