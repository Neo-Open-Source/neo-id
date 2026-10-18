use auth_core::{
    ACCESS_TOKEN_TTL, AccessInput, AuthError, ID_TOKEN_TTL, IdInput, sign_access, sign_id,
    verify_access, verify_id,
};

const PRIVATE_PEM: &str = include_str!("data/test-rsa.pem");
const PUBLIC_PEM: &str = include_str!("data/test-rsa.pub.pem");
const ISSUER: &str = "https://id.neome.uk";
const NOW: u64 = 1_800_000_000;

fn access_input() -> AccessInput {
    AccessInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        role: "user".to_string(),
        session_id: Some("sess-1".to_string()),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        jti: "jti-1".to_string(),
    }
}

#[test]
fn access_roundtrip_checks_claims() {
    let token = sign_access(PRIVATE_PEM.as_bytes(), &access_input()).unwrap();
    let claims = verify_access(PUBLIC_PEM.as_bytes(), &token, ISSUER, NOW + 100).unwrap();
    assert_eq!(claims.sub, "user-1");
    assert_eq!(claims.email, "alice@example.com");
    assert_eq!(claims.role, "user");
    assert_eq!(claims.session_id.as_deref(), Some("sess-1"));
    assert_eq!(
        u64::try_from(claims.exp_unix - claims.iat_unix).unwrap_or(0),
        ACCESS_TOKEN_TTL
    );
}

#[test]
fn expired_is_invalid_credentials() {
    let token = sign_access(PRIVATE_PEM.as_bytes(), &access_input()).unwrap();
    assert!(matches!(
        verify_access(
            PUBLIC_PEM.as_bytes(),
            &token,
            ISSUER,
            NOW + ACCESS_TOKEN_TTL + 1
        ),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn wrong_issuer_is_invalid_credentials() {
    let token = sign_access(PRIVATE_PEM.as_bytes(), &access_input()).unwrap();
    assert!(matches!(
        verify_access(PUBLIC_PEM.as_bytes(), &token, "https://evil.test", NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn tampered_payload_is_invalid_credentials() {
    let token = sign_access(PRIVATE_PEM.as_bytes(), &access_input()).unwrap();
    let mut tampered = token.clone();
    let start = token.find('.').unwrap() + 1;
    let marker = if token.as_bytes().get(start) == Some(&b'A') {
        'B'
    } else {
        'A'
    };
    tampered.replace_range(start..=start, &marker.to_string());
    assert_ne!(token, tampered);
    assert!(matches!(
        verify_access(PUBLIC_PEM.as_bytes(), &tampered, ISSUER, NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn garbage_is_malformed() {
    for token in ["abc", "a.b", "a.b.c"] {
        assert!(
            matches!(
                verify_access(PUBLIC_PEM.as_bytes(), token, ISSUER, NOW),
                Err(AuthError::MalformedMessage)
            ),
            "{token}"
        );
    }
}

#[test]
fn bad_key_is_internal() {
    assert!(matches!(
        verify_access(b"nope", "a.b.c", ISSUER, NOW),
        Err(AuthError::Internal)
    ));
}

#[test]
fn id_token_carries_audience_and_name() {
    let input = IdInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        audience: "client-9".to_string(),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        auth_time: NOW,
        nonce: Some("n-1".to_string()),
        access_token: None,
        jti: "jti-2".to_string(),
    };
    let token = sign_id(PRIVATE_PEM.as_bytes(), &input).unwrap();
    let payload: serde_json::Value = {
        let parts: Vec<&str> = token.split('.').collect();
        let decoded = base64_decode_url(parts[1]);
        serde_json::from_slice(&decoded).unwrap()
    };
    assert_eq!(payload["aud"], "client-9");
    assert_eq!(payload["nonce"], "n-1");
    assert_eq!(payload["name"], "alice@example.com");
    assert_eq!(
        u64::try_from(payload["exp"].as_i64().unwrap() - payload["iat"].as_i64().unwrap())
            .unwrap_or(0),
        ID_TOKEN_TTL
    );
}

#[test]
fn verify_id_checks_signature_issuer_and_expiry() {
    let input = IdInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        audience: "client-9".to_string(),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        auth_time: NOW,
        nonce: Some("n-1".to_string()),
        access_token: None,
        jti: "jti-9".to_string(),
    };
    let token = sign_id(PRIVATE_PEM.as_bytes(), &input).unwrap();
    let claims = verify_id(PUBLIC_PEM.as_bytes(), &token, ISSUER, NOW + 1).unwrap();
    assert_eq!(claims.sub, "user-1");
    assert_eq!(claims.nonce.as_deref(), Some("n-1"));
    assert_eq!(claims.auth_time_unix, Some(i64::try_from(NOW).unwrap()));
    assert!(matches!(
        verify_id(
            PUBLIC_PEM.as_bytes(),
            &token,
            ISSUER,
            NOW + ID_TOKEN_TTL + 1
        ),
        Err(AuthError::InvalidCredentials)
    ));
    assert!(matches!(
        verify_id(PUBLIC_PEM.as_bytes(), &token, "https://evil.test", NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

fn base64_decode_url(s: &str) -> Vec<u8> {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    URL_SAFE_NO_PAD.decode(s).unwrap()
}
