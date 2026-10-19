#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod clients;
mod connections;
mod identity;
mod mfa;
mod oauth;
mod opaque;
mod passkeys;
mod refresh;
mod sessions;
mod users;

pub use clients::{create_client, find_client};
pub use connections::{find_connection, upsert_connection};
pub use identity::{find_identity, insert_identity};
pub use mfa::{invalidate_pending, issue_code, latest_valid, mark_used};
pub use oauth::{create_code, delete_code, find_code};
pub use opaque::{OPAQUE_RECORDS_DDL, delete_envelope, find_envelope, upsert_envelope};
pub use passkeys::{
    PASSKEYS_BACKUP_COLUMNS_DDL, delete_passkey, insert_passkey, passkey_by_credential,
    passkeys_by_user, update_counter,
};
pub use refresh::{
    create_refresh, find_refresh, parse_refresh, revoke_refresh, revoke_session_refreshes,
    revoke_user_refreshes,
};
pub use sessions::{
    create_session, deactivate_session, deactivate_user_sessions, find_session, sessions_by_user,
    touch_session,
};
pub use users::{
    clear_reset_token, create_user, disable_totp, enable_totp, find_by_reset_hash,
    find_user_by_email, find_user_by_id, set_email, set_email_verified, set_reset_token,
    set_totp_secret, totp_secret, touch_login, update_profile,
};

pub use db::{
    Executor, Kv, Query, http_endpoint, instant, nullable, query_body, rows, text, text_array,
};
