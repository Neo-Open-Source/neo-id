use auth_core::{generate_secret, setup_uri, verify_totp};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

const RFC_SECRET: &str = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

fn rfc_vectors() -> Vec<(u64, &'static str)> {
    vec![
        (59, "287082"),
        (1_111_111_109, "081804"),
        (1_111_111_111, "050471"),
        (1_234_567_890, "005924"),
        (2_000_000_000, "279037"),
        (20_000_000_000, "353130"),
    ]
}

#[test]
fn rfc6238_sha1_vectors_verify() {
    for (time, code) in rfc_vectors() {
        assert!(verify_totp(RFC_SECRET, code, time).unwrap(), "{time}");
        assert!(!verify_totp(RFC_SECRET, "000000", time).unwrap());
    }
}

#[test]
fn skew_accepts_adjacent_step_rejects_distant() {
    let (time, code) = (1_111_111_109, "081804");
    assert!(verify_totp(RFC_SECRET, code, time + 30).unwrap());
    assert!(verify_totp(RFC_SECRET, code, time - 30).unwrap());
    assert!(!verify_totp(RFC_SECRET, code, time + 61).unwrap());
    assert!(!verify_totp(RFC_SECRET, code, time - 61).unwrap());
}

#[test]
fn undecodable_secret_is_malformed() {
    assert!(verify_totp("!!!", "123456", 59).is_err());
    assert!(setup_uri("!!!", "a@b.c").is_err());
}

#[test]
fn setup_uri_is_otpauth_totp() {
    let uri = setup_uri(RFC_SECRET, "alice@example.com").unwrap();
    assert!(uri.starts_with("otpauth://totp/"));
    assert!(uri.contains(RFC_SECRET));
    assert!(uri.contains("issuer=Neo"));
}

#[test]
fn generated_secret_roundtrips() {
    let secret = generate_secret(&mut ChaCha8Rng::seed_from_u64(5)).unwrap();
    assert!(setup_uri(&secret, "a@b.c").is_ok());
    let other = generate_secret(&mut ChaCha8Rng::seed_from_u64(6)).unwrap();
    assert_ne!(secret, other);
}
