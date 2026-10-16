#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod clients;
mod connections;
mod mfa;
mod oauth;
mod opaque;
mod passkeys;
mod refresh;
mod sessions;
mod transport;
mod users;

pub use clients::find_client;
pub use connections::{find_connection, upsert_connection};
pub use mfa::{invalidate_pending, issue_code, latest_valid, mark_used};
pub use oauth::{create_code, delete_code, find_code};
pub use opaque::{OPAQUE_RECORDS_DDL, delete_envelope, find_envelope, upsert_envelope};
pub use passkeys::{
    PASSKEYS_BACKUP_COLUMNS_DDL, delete_passkey, insert_passkey, passkeys_by_user, update_counter,
};
pub use refresh::{
    create_refresh, find_refresh, parse_refresh, revoke_refresh, revoke_session_refreshes,
    revoke_user_refreshes,
};
pub use sessions::{
    create_session, deactivate_session, deactivate_user_sessions, find_session, sessions_by_user,
    touch_session,
};
pub use transport::{http_endpoint, query_body, rows};
pub use users::{
    clear_reset_token, create_user, disable_totp, enable_totp, find_by_reset_hash,
    find_user_by_email, find_user_by_id, set_email, set_email_verified, set_reset_token,
    set_totp_secret, totp_secret, touch_login, update_profile,
};

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

fn text(value: &str) -> serde_json::Value {
    serde_json::Value::String(value.to_string())
}

fn nullable(value: Option<&str>) -> serde_json::Value {
    value.map_or(serde_json::Value::Null, text)
}

fn instant(unix_secs: u64) -> serde_json::Value {
    serde_json::Value::Number(i64::try_from(unix_secs).unwrap_or(i64::MAX).into())
}

#[cfg(test)]
mod id_cast_tests {
    use super::{
        create_code, create_refresh, create_session, create_user, insert_passkey, issue_code,
        upsert_connection,
    };

    #[test]
    fn inserts_cast_uuid_to_text_ids() {
        let statements = [
            create_user("a@b.co", 0).sql,
            create_session("u", None, None, 0).sql,
            create_refresh("u", "s", "h", None, None, None, 0).sql,
            create_code("c", "s", "app", "https://rp/cb", None, None, "u", 0).sql,
            issue_code("u", "verify", "123456", None, 0).sql,
            insert_passkey("u", "cred", "key", None, false, false).sql,
            upsert_connection("u", "app", &[], 0).sql,
        ];
        for sql in statements {
            assert!(sql.contains("gen_random_uuid()::text"), "{sql}");
        }
    }
}
