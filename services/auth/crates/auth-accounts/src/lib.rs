#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod login;
mod logout;
mod mfa;
mod mfa_challenge;
#[cfg(feature = "passkeys")]
mod passkeys;
mod password;
mod rate_limit;
mod refresh;
mod register;
mod sessions;
mod user;

pub use login::{
    LiteAccount, LiteMethods, LoginUser, MintParams, complete_login, lite_account, lite_methods,
    load_user, load_user_by_id, start_login,
};
pub use logout::{end_all_sessions, end_session};
pub use mfa::{
    CodeOutcome, request_email_code, totp_begin, totp_check, totp_disable, totp_enable,
    verify_email_code,
};
pub use mfa_challenge::{Attempt, clear_challenge, fail_attempt, load_challenge, store_challenge};
#[cfg(feature = "passkeys")]
pub use passkeys::{
    NewCredential, VerifiedCounter, authenticate_begin, authenticate_finish, register_begin,
    register_finish,
};
pub use password::{ForgotOutcome, forgot_password, reset_password};
pub use rate_limit::rate_limit_allow;
pub use refresh::{Rotation, rotate_refresh};
pub use register::{Availability, check_email, finish_registration};
pub use sessions::{list_sessions, revoke_all_sessions, revoke_session};
pub use user::{change_email_confirm, change_email_request, confirm_email, update_user_profile};

use auth_core::AuthError;
pub use auth_proto::auth::v1::MfaChallenge;

#[derive(Debug)]
pub enum Failure {
    Auth(AuthError),
    Code(&'static str),
}

impl From<AuthError> for Failure {
    fn from(err: AuthError) -> Self {
        Self::Auth(err)
    }
}
