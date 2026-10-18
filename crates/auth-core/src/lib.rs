#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod ciphersuite;
mod client;
mod codes;
mod email;
mod error;
mod jwt;
mod opaque;
mod pkce;
mod session;
mod setup;
mod totp;
#[cfg(feature = "webauthn")]
mod webauthn;

pub use ciphersuite::NeoSuite;
pub use client::{login_finalize, login_request, register_request, register_upload};
pub use codes::{constant_time_equal, generate_code, generate_id, generate_token, hash_token};
pub use email::{
    CODE_EXPIRY, CODE_LENGTH, RESEND_COOLDOWN, mask, normalize, resend_remaining_s,
    valid_code_format,
};
pub use error::AuthError;
pub use jwt::{
    ACCESS_TOKEN_TTL, AccessInput, ID_TOKEN_TTL, IdInput, KEY_ID, at_hash, sign_access, sign_id,
    verify_access, verify_id,
};
pub use opaque::{CredentialId, Envelope, LoginState, SessionKey};
pub use opaque::{login_finish, login_response, register_response, register_store};
pub use pkce::{enforce_pkce, generate_verifier, pkce_challenge, verify_pkce};
pub use session::{
    AUTHCODE_EXPIRY, INACTIVITY_TIMEOUT, REFRESH_EXPIRY, REFRESH_TOKEN_BYTES, RESET_TOKEN_EXPIRY,
    REUSE_WINDOW, RefreshDecision, SecretCheck, TICKET_EXPIRY, authcode_expiry,
    client_secret_check, encode_error, redirect_matches, refresh_decision, refresh_expiry,
    session_expiry, ticket_expiry,
};
pub use setup::OpaqueSetup;
pub use totp::{generate_secret, setup_uri, verify_totp};
#[cfg(feature = "webauthn")]
pub use webauthn::{
    AuthenticationState, CreationChallengeResponse, PasskeyRp, RegistrationState,
    RequestChallengeResponse, StoredCredential, VerifiedAuthentication, authentication_options,
    registration_options, user_uuid, verify_authentication, verify_registration,
};
