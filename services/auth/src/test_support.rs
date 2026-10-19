use auth_core::{KeyRing, OpaqueSetup, SigningAlg, SigningKey, VerifyKey};
use rand_chacha::ChaCha8Rng;
use rand_core::SeedableRng;

use crate::env::AppEnv;
use crate::neon::NeonExecutor;
use crate::routes::Ctx;

const PRIVATE_PEM: &str = include_str!("../../../crates/auth-core/tests/data/test-rsa.pem");
const PUBLIC_PEM: &str = include_str!("../../../crates/auth-core/tests/data/test-rsa.pub.pem");
const EC_PRIVATE_PEM: &str = include_str!("../../../crates/auth-core/tests/data/test-ec.pem");
const EC_PUBLIC_PEM: &str = include_str!("../../../crates/auth-core/tests/data/test-ec.pub.pem");

pub(crate) const TEST_ISSUER: &str = "https://id.neome.uk";

pub(crate) fn test_ctx(now: u64) -> Ctx {
    test_ctx_with(now, SigningAlg::Rs256)
}

pub(crate) fn test_ctx_with(now: u64, alg: SigningAlg) -> Ctx {
    let setup = OpaqueSetup::generate(&mut ChaCha8Rng::seed_from_u64(7));
    let (signing, es256_public_pem) = match alg {
        SigningAlg::Es256 => (
            SigningKey::new(SigningAlg::Es256, EC_PRIVATE_PEM.as_bytes().to_vec()),
            Some(EC_PUBLIC_PEM.as_bytes().to_vec()),
        ),
        _ => (
            SigningKey::new(SigningAlg::Rs256, PRIVATE_PEM.as_bytes().to_vec()),
            None,
        ),
    };
    let mut keys = vec![VerifyKey::new(
        SigningAlg::Rs256,
        PUBLIC_PEM.as_bytes().to_vec(),
    )];
    if let Some(public) = es256_public_pem.as_ref() {
        keys.push(VerifyKey::new(SigningAlg::Es256, public.clone()));
    }
    let app = AppEnv {
        endpoint: "https://db.example/sql".to_string(),
        signing,
        verify_keys: KeyRing::new(keys),
        rsa_public_pem: PUBLIC_PEM.as_bytes().to_vec(),
        es256_public_pem,
        setup,
        issuer: TEST_ISSUER.to_string(),
        mail_url: None,
        mail_key: String::new(),
        web_origin: TEST_ISSUER.to_string(),
        turnstile_secret: None,
        altcha_secret: None,
        altcha_fallback: true,
        google_client_id: None,
        google_client_secret: None,
        github_client_id: None,
        github_client_secret: None,
        #[cfg(feature = "passkeys")]
        rp_id: "id.neome.uk".to_string(),
        #[cfg(feature = "passkeys")]
        rp_origin: TEST_ISSUER.to_string(),
    };
    Ctx {
        request_id: "req-test".to_string(),
        now_ms: now * 1000,
        now,
        app,
        db: NeonExecutor::new("https://db.example/sql".to_string(), String::new()),
    }
}

pub(crate) fn test_access_token(cx: &Ctx) -> String {
    auth_core::sign_access(
        &cx.app.signing,
        &auth_core::AccessInput {
            sub: "u1".to_string(),
            email: "a@b.c".to_string(),
            role: "user".to_string(),
            session_id: Some("s1".to_string()),
            issuer: cx.app.issuer.clone(),
            issued_at: cx.now,
            auth_time: cx.now,
            scope: "openid".to_string(),
            jti: "j1".to_string(),
        },
    )
    .unwrap()
}
