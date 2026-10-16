use auth_core::{generate_verifier, pkce_challenge, verify_pkce};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

#[test]
fn rfc7636_vector() {
    assert_eq!(
        pkce_challenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"),
        "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
    );
}

#[test]
fn verify_roundtrip() {
    let verifier = generate_verifier(&mut ChaCha8Rng::seed_from_u64(5));
    assert_eq!(verifier.len(), 43);
    let challenge = pkce_challenge(&verifier);
    assert!(verify_pkce(&verifier, &challenge));
    assert!(!verify_pkce("other", &challenge));
    assert!(!verify_pkce(
        &verifier,
        "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
    ));
}

#[test]
fn verifiers_differ() {
    assert_ne!(
        generate_verifier(&mut ChaCha8Rng::seed_from_u64(5)),
        generate_verifier(&mut ChaCha8Rng::seed_from_u64(6))
    );
}
