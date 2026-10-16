use auth_core::{constant_time_equal, generate_code, generate_id, generate_token, hash_token};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

#[test]
fn token_is_unpadded_urlsafe_base64() {
    let token = generate_token(&mut ChaCha8Rng::seed_from_u64(5), 64);
    assert_eq!(token.len(), 86);
    assert!(
        token
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
    );
    assert_ne!(token, generate_token(&mut ChaCha8Rng::seed_from_u64(6), 64));
}

#[test]
fn token_hash_is_sha256_hex() {
    assert_eq!(
        hash_token("abc"),
        "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
    );
    assert_ne!(hash_token("a"), hash_token("b"));
}

#[test]
fn id_is_v4_uuid() {
    let id = generate_id(&mut ChaCha8Rng::seed_from_u64(5));
    assert_eq!(id.len(), 36);
    assert_eq!(&id[14..15], "4");
    assert_eq!(&id[8..9], "-");
    assert_ne!(id, generate_id(&mut ChaCha8Rng::seed_from_u64(6)));
}

#[test]
fn id_version_and_variant_hold_for_many_seeds() {
    for seed in 0..64u64 {
        let id = generate_id(&mut ChaCha8Rng::seed_from_u64(seed));
        assert_eq!(&id[14..15], "4", "{seed}");
        assert!(matches!(&id[19..20], "8" | "9" | "a" | "b"), "{seed}");
    }
}

#[test]
fn code_is_numeric_of_length() {
    let code = generate_code(&mut ChaCha8Rng::seed_from_u64(5), 6);
    assert_eq!(code.len(), 6);
    assert!(code.bytes().all(|b| b.is_ascii_digit()));
}

#[test]
fn code_uses_full_digit_range() {
    let mut seen = [false; 10];
    for seed in 0..40 {
        for byte in generate_code(&mut ChaCha8Rng::seed_from_u64(seed), 6).bytes() {
            seen[(byte - b'0') as usize] = true;
        }
    }
    assert!(seen.iter().all(|s| *s));
}

#[test]
fn constant_time_equal_facts() {
    assert!(constant_time_equal(b"abcdef", b"abcdef"));
    assert!(!constant_time_equal(b"abcdef", b"abcdeg"));
    assert!(!constant_time_equal(b"abc", b"abcd"));
}
