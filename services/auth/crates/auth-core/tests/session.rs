use auth_core::{
    RefreshDecision, SecretCheck, StoredRefresh, authcode_expiry, client_secret_check,
    encode_error, enforce_pkce, generate_verifier, pkce_challenge, redirect_matches,
    refresh_decision, refresh_expiry, session_expiry, ticket_expiry,
};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

fn stored() -> StoredRefresh<'static> {
    StoredRefresh {
        revoked_at: None,
        revoke_reason: None,
        expires_at: 2000,
        banned: false,
        session_active: true,
        has_session: true,
    }
}

#[test]
fn refresh_decision_tree() {
    assert_eq!(refresh_decision(&stored(), 1000), RefreshDecision::Reissue);
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                expires_at: 1000,
                ..stored()
            },
            1000
        ),
        RefreshDecision::Expired
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                banned: true,
                ..stored()
            },
            500
        ),
        RefreshDecision::UserBanned
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                has_session: false,
                ..stored()
            },
            500
        ),
        RefreshDecision::NoSession
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                session_active: false,
                ..stored()
            },
            500
        ),
        RefreshDecision::SessionInactive
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                revoked_at: Some(900),
                revoke_reason: Some("logout"),
                ..stored()
            },
            950
        ),
        RefreshDecision::TokenInvalid
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                revoked_at: Some(900),
                revoke_reason: Some("rotated"),
                ..stored()
            },
            950
        ),
        RefreshDecision::GraceReissue
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                revoked_at: Some(900),
                revoke_reason: Some("rotated"),
                ..stored()
            },
            960
        ),
        RefreshDecision::TokenInvalid
    );
    assert_eq!(
        refresh_decision(
            &StoredRefresh {
                revoked_at: Some(900),
                revoke_reason: Some("rotated"),
                ..stored()
            },
            961
        ),
        RefreshDecision::TokenInvalid
    );
}

#[test]
fn decision_wire_codes_match_ts() {
    assert_eq!(encode_error(&RefreshDecision::Reissue), "ok");
    assert_eq!(encode_error(&RefreshDecision::GraceReissue), "ok");
    assert_eq!(encode_error(&RefreshDecision::Expired), "TOKEN_EXPIRED");
    assert_eq!(encode_error(&RefreshDecision::UserBanned), "USER_BANNED");
    assert_eq!(encode_error(&RefreshDecision::NoSession), "INVALID_REQUEST");
    assert_eq!(
        encode_error(&RefreshDecision::SessionInactive),
        "TOKEN_INVALID"
    );
    assert_eq!(
        encode_error(&RefreshDecision::TokenInvalid),
        "TOKEN_INVALID"
    );
}

#[test]
fn expiry_helpers_add_ttl() {
    assert_eq!(refresh_expiry(1000), 1000 + 2_592_000);
    assert_eq!(session_expiry(1000), 1000 + 2_592_000);
    assert_eq!(authcode_expiry(1000), 1600);
    assert_eq!(ticket_expiry(1000), 1060);
}

#[test]
fn redirect_match_ignores_trailing_slash() {
    let registered = ["https://app.example/cb", "https://app.example/other/"];
    assert!(redirect_matches(&registered, "https://app.example/cb"));
    assert!(redirect_matches(&registered, "https://app.example/cb/"));
    assert!(redirect_matches(
        &registered,
        "  https://app.example/other "
    ));
    assert!(!redirect_matches(&registered, "https://evil.example/cb"));
}

#[test]
fn pkce_policy() {
    let verifier = generate_verifier(&mut ChaCha8Rng::seed_from_u64(5));
    let challenge = pkce_challenge(&verifier);
    assert!(enforce_pkce(Some(&challenge), true, Some(&verifier)).is_ok());
    assert!(enforce_pkce(Some(&challenge), true, Some("wrong")).is_err());
    assert!(enforce_pkce(Some(&challenge), true, None).is_err());
    assert!(enforce_pkce(None, true, None).is_err());
    assert!(enforce_pkce(None, false, None).is_ok());
    assert!(enforce_pkce(Some(&challenge), false, Some(&verifier)).is_ok());
}

#[test]
fn secret_check_forms() {
    assert_eq!(client_secret_check(None, Some("x")), SecretCheck::Skipped);
    assert_eq!(client_secret_check(Some("x"), None), SecretCheck::Skipped);
    let bcrypt_hash = bcrypt::hash("s3cret", 4).unwrap();
    assert_eq!(
        client_secret_check(Some(&bcrypt_hash), Some("s3cret")),
        SecretCheck::Valid
    );
    assert_eq!(
        client_secret_check(Some(&bcrypt_hash), Some("wrong")),
        SecretCheck::Invalid
    );
    let sha_hash = auth_core::hash_token("s3cret");
    assert_eq!(
        client_secret_check(Some(&sha_hash), Some("s3cret")),
        SecretCheck::Valid
    );
    assert_eq!(
        client_secret_check(Some(&sha_hash), Some("wrong")),
        SecretCheck::Invalid
    );
}
