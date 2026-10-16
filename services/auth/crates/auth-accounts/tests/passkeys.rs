#![cfg(feature = "passkeys")]

mod common;

use auth_accounts::{authenticate_begin, register_begin, register_finish};
use auth_core::{AuthError, PasskeyRp};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use common::{Scripted, run};

fn rp() -> PasskeyRp {
    PasskeyRp::new("example.com", "https://example.com").unwrap()
}

const REAL_ES256_COSE: [u8; 77] = [
    165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 79, 120, 96, 38, 152, 72, 174, 160, 13, 220, 173, 53, 215,
    173, 221, 92, 245, 218, 56, 26, 82, 221, 115, 46, 254, 214, 240, 101, 160, 128, 143, 242, 34,
    88, 32, 231, 197, 238, 104, 240, 194, 89, 69, 43, 105, 174, 88, 245, 150, 235, 155, 40, 96,
    186, 201, 63, 163, 59, 168, 165, 26, 192, 122, 251, 192, 152, 66,
];

#[test]
fn begins_return_options_and_state() {
    let empty = Scripted::feed(vec![vec![]]);
    let (json, state) = run(register_begin(&empty, &rp(), "u1", "a@b.c")).unwrap();
    assert!(json.contains("publicKey"));
    assert_ne!(state.len(), 0);

    let empty = Scripted::feed(vec![vec![]]);
    assert!(matches!(
        run(authenticate_begin(&empty, &rp(), "u1")),
        Err(AuthError::InvalidCredentials)
    ));

    let listed = Scripted::feed(vec![vec![serde_json::json!({
        "credentialId": URL_SAFE_NO_PAD.encode([7u8; 32]),
        "publicKey": URL_SAFE_NO_PAD.encode(REAL_ES256_COSE),
        "counter": 0,
    })]]);
    let (json, state) = run(authenticate_begin(&listed, &rp(), "u1")).unwrap();
    assert!(json.contains("publicKey"));
    assert_ne!(state.len(), 0);
}

#[test]
fn finish_rejects_garbage_state() {
    assert!(matches!(
        register_finish(&rp(), "{}", b"nope"),
        Err(AuthError::MalformedMessage)
    ));
}
