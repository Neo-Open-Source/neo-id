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
