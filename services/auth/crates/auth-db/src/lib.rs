#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod clients;
mod oauth;
mod opaque;
mod passkeys;
mod refresh;
mod sessions;
mod transport;
mod users;

pub use clients::find_client;
pub use oauth::{create_code, delete_code, find_code};
pub use opaque::{OPAQUE_RECORDS_DDL, delete_envelope, find_envelope, upsert_envelope};
pub use passkeys::{
    PASSKEYS_BACKUP_COLUMNS_DDL, delete_passkey, insert_passkey, passkeys_by_user, update_counter,
};
pub use refresh::{create_refresh, find_refresh, revoke_refresh};
pub use sessions::{
    create_session, deactivate_session, deactivate_user_sessions, find_session, touch_session,
};
pub use transport::{http_endpoint, query_body, rows};
pub use users::{find_user_by_email, find_user_by_id, touch_login};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Query {
    pub sql: &'static str,
    pub params: Vec<serde_json::Value>,
}

fn text(value: &str) -> serde_json::Value {
    serde_json::Value::String(value.to_string())
}

fn nullable(value: Option<&str>) -> serde_json::Value {
    value.map_or(serde_json::Value::Null, text)
}

fn instant(unix_secs: u64) -> serde_json::Value {
    serde_json::Value::Number(i64::try_from(unix_secs).unwrap_or(i64::MAX).into())
}
