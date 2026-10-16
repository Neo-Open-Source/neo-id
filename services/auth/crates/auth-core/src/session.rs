use crate::codes::{constant_time_equal, hash_token};

pub const REFRESH_EXPIRY: u64 = 2_592_000;
pub const INACTIVITY_TIMEOUT: u64 = 2_592_000;
pub const AUTHCODE_EXPIRY: u64 = 600;
pub const TICKET_EXPIRY: u64 = 60;
pub const REUSE_WINDOW: u64 = 60;

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

pub struct StoredRefresh<'a> {
    pub revoked_at: Option<u64>,
    pub revoke_reason: Option<&'a str>,
    pub expires_at: u64,
    pub banned: bool,
    pub session_active: bool,
    pub has_session: bool,
}

#[must_use]
pub fn refresh_decision(stored: &StoredRefresh<'_>, now: u64) -> RefreshDecision {
    if let Some(revoked_at) = stored.revoked_at {
        let rotated = stored.revoke_reason == Some("rotated");
        if rotated && stored.has_session && now.saturating_sub(revoked_at) < REUSE_WINDOW {
            return RefreshDecision::GraceReissue;
        }
        return RefreshDecision::TokenInvalid;
    }
    if stored.expires_at <= now {
        return RefreshDecision::Expired;
    }
    if stored.banned {
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
        (None, _) | (_, None) => SecretCheck::Skipped,
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
