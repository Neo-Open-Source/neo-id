#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod transport;

pub use transport::{http_endpoint, query_body, rows};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Query {
    pub sql: &'static str,
    pub params: Vec<serde_json::Value>,
}

pub trait Executor {
    fn run(
        &self,
        query: Query,
    ) -> impl std::future::Future<Output = Result<Vec<serde_json::Value>, auth_core::AuthError>>;
}

pub trait Kv {
    fn get(
        &self,
        key: &str,
    ) -> impl std::future::Future<Output = Result<Option<Vec<u8>>, auth_core::AuthError>>;
    fn put(
        &self,
        key: &str,
        value: &[u8],
        ttl_secs: u64,
    ) -> impl std::future::Future<Output = Result<(), auth_core::AuthError>>;
    fn delete(
        &self,
        key: &str,
    ) -> impl std::future::Future<Output = Result<(), auth_core::AuthError>>;
}

#[must_use]
pub fn text(value: &str) -> serde_json::Value {
    serde_json::Value::String(value.to_string())
}

#[must_use]
pub fn nullable(value: Option<&str>) -> serde_json::Value {
    value.map_or(serde_json::Value::Null, text)
}

#[must_use]
pub fn instant(unix_secs: u64) -> serde_json::Value {
    serde_json::Value::Number(i64::try_from(unix_secs).unwrap_or(i64::MAX).into())
}

#[must_use]
pub fn text_array(values: &[&str]) -> serde_json::Value {
    serde_json::Value::Array(values.iter().map(|value| text(value)).collect())
}

#[cfg(test)]
mod tests {
    use super::{instant, nullable, text, text_array};

    #[test]
    fn param_helpers_serialize_to_expected_json() {
        assert_eq!(text("a"), serde_json::json!("a"));
        assert_eq!(nullable(None), serde_json::Value::Null);
        assert_eq!(nullable(Some("x")), serde_json::json!("x"));
        assert_eq!(instant(42), serde_json::json!(42));
        assert_eq!(instant(u64::MAX), serde_json::json!(i64::MAX));
        assert_eq!(text_array(&["a", "b"]), serde_json::json!(["a", "b"]));
    }
}
