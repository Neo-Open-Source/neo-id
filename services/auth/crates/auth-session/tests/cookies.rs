use auth_core::AuthError;
use auth_session::{issue_cookie, verify_cookie};

const SECRET: &[u8] = b"test-secret-32-bytes-long!!!!!!!";

#[test]
fn roundtrip() {
    let cookie = issue_cookie(SECRET, "sess-1", 3600, 1000).unwrap();
    assert_eq!(verify_cookie(SECRET, &cookie, 2000).unwrap(), "sess-1");
}

#[test]
fn expired_rejected() {
    let cookie = issue_cookie(SECRET, "sess-1", 100, 1000).unwrap();
    assert!(matches!(
        verify_cookie(SECRET, &cookie, 1101),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn tampered_rejected() {
    let cookie = issue_cookie(SECRET, "sess-1", 3600, 1000).unwrap();
    let mut tampered = cookie.clone();
    tampered.replace_range(0..1, "x");
    assert!(verify_cookie(SECRET, &tampered, 2000).is_err());
    assert!(matches!(
        verify_cookie(b"other-secret-32-bytes-long!!!!!", &cookie, 2000),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn shapeless_rejected_as_malformed() {
    for bad in ["", "nodots", "a.b", "a.b.c.d", "sess.notanumber.sig"] {
        assert!(
            matches!(
                verify_cookie(SECRET, bad, 2000),
                Err(AuthError::MalformedMessage)
            ),
            "{bad}"
        );
    }
}

#[test]
fn empty_secret_is_internal() {
    assert!(matches!(
        issue_cookie(b"", "sess-1", 100, 1000),
        Err(AuthError::Internal)
    ));
}
