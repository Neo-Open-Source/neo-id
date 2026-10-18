use auth_core::{
    ACCESS_TOKEN_TTL, AccessInput, AuthError, ID_TOKEN_TTL, IdInput, SigningAlg, SigningKey,
    VerifyKey, at_hash, sign_access, sign_id, verify_access, verify_id,
};

const PRIVATE_PEM: &str = include_str!("data/test-rsa.pem");
const PUBLIC_PEM: &str = include_str!("data/test-rsa.pub.pem");
const EC_PRIVATE_PEM: &str = include_str!("data/test-ec.pem");
const EC_PUBLIC_PEM: &str = include_str!("data/test-ec.pub.pem");
const ISSUER: &str = "https://id.neome.uk";
const NOW: u64 = 1_800_000_000;

fn rsa_signing() -> SigningKey {
    SigningKey::new(SigningAlg::Rs256, PRIVATE_PEM.as_bytes().to_vec())
}

fn rsa_verifying() -> VerifyKey {
    VerifyKey::new(SigningAlg::Rs256, PUBLIC_PEM.as_bytes().to_vec())
}

fn ec_signing() -> SigningKey {
    SigningKey::new(SigningAlg::Es256, EC_PRIVATE_PEM.as_bytes().to_vec())
}

fn ec_verifying() -> VerifyKey {
    VerifyKey::new(SigningAlg::Es256, EC_PUBLIC_PEM.as_bytes().to_vec())
}

fn access_input() -> AccessInput {
    AccessInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        role: "user".to_string(),
        session_id: Some("sess-1".to_string()),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        auth_time: NOW,
        scope: "openid profile".to_string(),
        jti: "jti-1".to_string(),
    }
}

fn header_alg(token: &str) -> String {
    header_field(token, "alg")
}

fn header_kid(token: &str) -> String {
    header_field(token, "kid")
}

fn header_field(token: &str, field: &str) -> String {
    let decoded = base64_decode_url(token.split('.').next().unwrap_or_default());
    serde_json::from_slice::<serde_json::Value>(&decoded)
        .ok()
        .and_then(|header| header[field].as_str().map(String::from))
        .unwrap_or_default()
}

#[test]
fn access_roundtrip_checks_claims() {
    let token = sign_access(&rsa_signing(), &access_input()).unwrap();
    let claims = verify_access(&rsa_verifying(), &token, ISSUER, NOW + 100).unwrap();
    assert_eq!(claims.sub, "user-1");
    assert_eq!(claims.email, "alice@example.com");
    assert_eq!(claims.role, "user");
    assert_eq!(claims.session_id.as_deref(), Some("sess-1"));
    assert_eq!(claims.auth_time_unix, Some(i64::try_from(NOW).unwrap_or(0)));
    assert_eq!(claims.scope.as_deref(), Some("openid profile"));
    assert_eq!(
        u64::try_from(claims.exp_unix - claims.iat_unix).unwrap_or(0),
        ACCESS_TOKEN_TTL
    );
}

#[test]
fn es256_roundtrip_and_header_algorithm() {
    let token = sign_access(&ec_signing(), &access_input()).unwrap();
    assert_eq!(header_alg(&token), "ES256");
    assert_eq!(header_kid(&token), "neo-auth-es256");
    let claims = verify_access(&ec_verifying(), &token, ISSUER, NOW + 100).unwrap();
    assert_eq!(claims.sub, "user-1");
    assert_eq!(claims.scope.as_deref(), Some("openid profile"));
}

#[test]
fn signing_alg_metadata_is_pinned() {
    assert_eq!(SigningAlg::Rs256.name(), "RS256");
    assert_eq!(SigningAlg::Es256.name(), "ES256");
    assert_eq!(SigningAlg::Rs256.kid(), "neo-auth-rs256");
    assert_eq!(SigningAlg::Es256.kid(), "neo-auth-es256");
}

#[test]
fn key_debug_reveals_alg_but_not_pem_material() {
    let signing = format!("{:?}", rsa_signing());
    assert!(signing.contains("Rs256"));
    assert!(!signing.contains("PRIVATE KEY"));
    let verify = format!("{:?}", rsa_verifying());
    assert!(verify.contains("Rs256"));
    assert!(!verify.contains("PUBLIC KEY"));
}

#[test]
fn rs256_token_is_rejected_by_es256_key_and_vice_versa() {
    let rsa_token = sign_access(&rsa_signing(), &access_input()).unwrap();
    assert_eq!(header_alg(&rsa_token), "RS256");
    assert!(matches!(
        verify_access(&ec_verifying(), &rsa_token, ISSUER, NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
    let ec_token = sign_access(&ec_signing(), &access_input()).unwrap();
    assert!(matches!(
        verify_access(&rsa_verifying(), &ec_token, ISSUER, NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn es256_id_token_is_verifiable() {
    let input = IdInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        audience: "client-9".to_string(),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        auth_time: NOW,
        nonce: Some("n-1".to_string()),
        access_token: None,
        jti: "jti-ec".to_string(),
    };
    let token = sign_id(&ec_signing(), &input).unwrap();
    let claims = verify_id(&ec_verifying(), &token, ISSUER, NOW + 1).unwrap();
    assert_eq!(claims.sub, "user-1");
    assert_eq!(claims.aud, "client-9");
    assert_eq!(claims.nonce.as_deref(), Some("n-1"));
}

#[test]
fn at_hash_is_left_half_of_sha256_base64url() {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    use sha2::{Digest, Sha256};
    let token = "some-access-token";
    let digest = Sha256::digest(token.as_bytes());
    let expected = URL_SAFE_NO_PAD.encode(&digest[..16]);
    assert_eq!(at_hash(token), expected);
    assert_eq!(at_hash(token).len(), 22);
    assert_ne!(at_hash(token), at_hash("other-token"));
}

#[test]
fn expired_is_invalid_credentials() {
    let token = sign_access(&rsa_signing(), &access_input()).unwrap();
    assert!(matches!(
        verify_access(&rsa_verifying(), &token, ISSUER, NOW + ACCESS_TOKEN_TTL + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn wrong_issuer_is_invalid_credentials() {
    let token = sign_access(&rsa_signing(), &access_input()).unwrap();
    assert!(matches!(
        verify_access(&rsa_verifying(), &token, "https://evil.test", NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn tampered_payload_is_invalid_credentials() {
    let token = sign_access(&rsa_signing(), &access_input()).unwrap();
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
        verify_access(&rsa_verifying(), &tampered, ISSUER, NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn garbage_is_malformed() {
    for token in ["abc", "a.b", "a.b.c"] {
        assert!(
            matches!(
                verify_access(&rsa_verifying(), token, ISSUER, NOW),
                Err(AuthError::MalformedMessage)
            ),
            "{token}"
        );
    }
}

#[test]
fn bad_key_is_internal() {
    let broken = VerifyKey::new(SigningAlg::Rs256, b"nope".to_vec());
    assert!(matches!(
        verify_access(&broken, "a.b.c", ISSUER, NOW),
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
    let token = sign_id(&rsa_signing(), &input).unwrap();
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
    let token = sign_id(&rsa_signing(), &input).unwrap();
    let claims = verify_id(&rsa_verifying(), &token, ISSUER, NOW + 1).unwrap();
    assert_eq!(claims.sub, "user-1");
    assert_eq!(claims.nonce.as_deref(), Some("n-1"));
    assert_eq!(claims.auth_time_unix, Some(i64::try_from(NOW).unwrap()));
    assert!(matches!(
        verify_id(&rsa_verifying(), &token, ISSUER, NOW + ID_TOKEN_TTL + 1),
        Err(AuthError::InvalidCredentials)
    ));
    assert!(matches!(
        verify_id(&rsa_verifying(), &token, "https://evil.test", NOW + 1),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn zero_auth_time_and_empty_scope_are_omitted() {
    let id = IdInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        audience: "client-9".to_string(),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        auth_time: 0,
        nonce: None,
        access_token: None,
        jti: "jti-0".to_string(),
    };
    let payload: serde_json::Value = {
        let token = sign_id(&rsa_signing(), &id).unwrap();
        let parts: Vec<&str> = token.split('.').collect();
        serde_json::from_slice(&base64_decode_url(parts[1])).unwrap()
    };
    assert!(payload.get("auth_time").is_none());

    let access = AccessInput {
        sub: "user-1".to_string(),
        email: "alice@example.com".to_string(),
        role: "user".to_string(),
        session_id: Some("sess-1".to_string()),
        issuer: ISSUER.to_string(),
        issued_at: NOW,
        auth_time: 0,
        scope: String::new(),
        jti: "jti-0".to_string(),
    };
    let token = sign_access(&rsa_signing(), &access).unwrap();
    let claims = verify_access(&rsa_verifying(), &token, ISSUER, NOW + 1).unwrap();
    assert_eq!(claims.auth_time_unix, None);
    assert_eq!(claims.scope, None);
}

fn base64_decode_url(s: &str) -> Vec<u8> {
    use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
    URL_SAFE_NO_PAD.decode(s).unwrap()
}
