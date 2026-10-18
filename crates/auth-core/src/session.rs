use crate::codes::{constant_time_equal, hash_token};
use auth_proto::auth::v1::RefreshToken;

pub const REFRESH_EXPIRY: u64 = 2_592_000;
pub const INACTIVITY_TIMEOUT: u64 = 2_592_000;
pub const AUTHCODE_EXPIRY: u64 = 600;
pub const TICKET_EXPIRY: u64 = 60;
pub const REUSE_WINDOW: u64 = 60;
pub const REFRESH_TOKEN_BYTES: usize = 64;
pub const RESET_TOKEN_EXPIRY: u64 = 3600;

#[must_use]
pub fn refresh_expiry(now: u64) -> u64 {
    now + REFRESH_EXPIRY
}

#[must_use]
pub fn session_expiry(now: u64) -> u64 {
    now + INACTIVITY_TIMEOUT
}

#[must_use]
pub fn authcode_expiry(now: u64) -> u64 {
    now + AUTHCODE_EXPIRY
}

#[must_use]
pub fn ticket_expiry(now: u64) -> u64 {
    now + TICKET_EXPIRY
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RefreshDecision {
    Reissue,
    GraceReissue,
    Expired,
    UserBanned,
    NoSession,
    SessionInactive,
    TokenInvalid,
}

#[must_use]
pub fn refresh_decision(stored: &RefreshToken, now: u64) -> RefreshDecision {
    if let Some(revoked_at) = stored.revoked_at_unix {
        let rotated = stored.revoke_reason.as_deref() == Some("rotated");
        let revoked: u64 = revoked_at.try_into().unwrap_or(0);
        if rotated && stored.has_session && now.saturating_sub(revoked) < REUSE_WINDOW {
            return RefreshDecision::GraceReissue;
        }
        return RefreshDecision::TokenInvalid;
    }
    if stored.expires_at_unix <= i64::try_from(now).unwrap_or(i64::MAX) {
        return RefreshDecision::Expired;
    }
    if stored.user_banned {
        return RefreshDecision::UserBanned;
    }
    if !stored.has_session {
        return RefreshDecision::NoSession;
    }
    if !stored.session_active {
        return RefreshDecision::SessionInactive;
    }
    RefreshDecision::Reissue
}

#[must_use]
pub fn redirect_matches(registered: &[&str], incoming: &str) -> bool {
    let normalized = incoming.trim().trim_end_matches('/');
    registered
        .iter()
        .any(|uri| uri.trim().trim_end_matches('/') == normalized)
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SecretCheck {
    Skipped,
    Valid,
    Invalid,
}

#[must_use]
pub fn client_secret_check(stored_hash: Option<&str>, presented: Option<&str>) -> SecretCheck {
    match (stored_hash, presented) {
        (None, _) => SecretCheck::Skipped,
        (Some(_), None) => SecretCheck::Invalid,
        (Some(stored), Some(secret)) if stored.starts_with("$2") => {
            match bcrypt::verify(secret, stored) {
                Ok(true) => SecretCheck::Valid,
                _ => SecretCheck::Invalid,
            }
        }
        (Some(stored), Some(secret)) => {
            if constant_time_equal(hash_token(secret).as_bytes(), stored.as_bytes()) {
                SecretCheck::Valid
            } else {
                SecretCheck::Invalid
            }
        }
    }
}

#[must_use]
pub fn encode_error(decision: &RefreshDecision) -> &'static str {
    match decision {
        RefreshDecision::Reissue | RefreshDecision::GraceReissue => "ok",
        RefreshDecision::Expired => "TOKEN_EXPIRED",
        RefreshDecision::UserBanned => "USER_BANNED",
        RefreshDecision::NoSession => "INVALID_REQUEST",
        RefreshDecision::SessionInactive | RefreshDecision::TokenInvalid => "TOKEN_INVALID",
    }
}
