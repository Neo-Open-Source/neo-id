use auth_core::{
    AltchaChallenge, AltchaPayload, AltchaSolution, create_altcha_challenge, verify_altcha,
};
use pbkdf2::pbkdf2_hmac;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use sha2::Sha256;

const SECRET: &str = "test-secret";
const NOW: u64 = 1_800_000_000;
const COST: u32 = 100;

fn derive_hex(nonce: &[u8], counter: u32, salt: &[u8], cost: u32, key_length: u32) -> String {
    let mut password = nonce.to_vec();
    password.extend_from_slice(&counter.to_be_bytes());
    let mut out = vec![0u8; key_length as usize];
    pbkdf2_hmac::<Sha256>(&password, salt, cost, &mut out);
    hex::encode(&out)
}

fn solve(challenge: &AltchaChallenge) -> AltchaPayload {
    let parameters = challenge.parameters.as_ref().unwrap();
    let nonce = hex::decode(&parameters.nonce).unwrap();
    let salt = hex::decode(&parameters.salt).unwrap();
    let mut counter: u32 = 0;
    loop {
        let derived = derive_hex(
            &nonce,
            counter,
            &salt,
            parameters.cost,
            parameters.key_length,
        );
        if derived.starts_with(&parameters.key_prefix) {
            return AltchaPayload {
                challenge: Some(challenge.clone()),
                solution: Some(AltchaSolution {
                    counter,
                    derived_key: derived,
                    time: None,
                }),
            };
        }
        counter += 1;
    }
}

#[test]
fn altcha_v2_roundtrip_verifies() {
    let mut rng = ChaCha8Rng::seed_from_u64(1);
    let challenge = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let payload = solve(&challenge);
    assert!(verify_altcha(&payload, SECRET, NOW + 1).unwrap());
}

#[test]
fn altcha_v2_rejects_tampered_and_expired() {
    let mut rng = ChaCha8Rng::seed_from_u64(1);
    let challenge = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let payload = solve(&challenge);

    let mut wrong_sig = payload.clone();
    if let Some(challenge) = wrong_sig.challenge.as_mut() {
        challenge.signature = Some("00".to_string());
    }
    assert!(!verify_altcha(&wrong_sig, SECRET, NOW + 1).unwrap());

    let mut wrong_key = payload.clone();
    if let Some(solution) = wrong_key.solution.as_mut() {
        solution.derived_key = "00".to_string();
    }
    assert!(!verify_altcha(&wrong_key, SECRET, NOW + 1).unwrap());

    assert!(!verify_altcha(&payload, SECRET, NOW + 10_000).unwrap());
}

#[test]
fn altcha_v2_rejects_missing_fields_and_wrong_algorithm() {
    let mut rng = ChaCha8Rng::seed_from_u64(2);
    let challenge = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let payload = solve(&challenge);

    let empty = AltchaPayload {
        challenge: None,
        solution: None,
    };
    assert!(!verify_altcha(&empty, SECRET, NOW + 1).unwrap());

    let mut no_solution = payload.clone();
    no_solution.solution = None;
    assert!(!verify_altcha(&no_solution, SECRET, NOW + 1).unwrap());

    let mut bad_algorithm = payload.clone();
    if let Some(challenge) = bad_algorithm.challenge.as_mut() {
        if let Some(parameters) = challenge.parameters.as_mut() {
            parameters.algorithm = "ARGON2ID".to_string();
        }
    }
    assert!(!verify_altcha(&bad_algorithm, SECRET, NOW + 1).unwrap());
}

#[test]
fn altcha_signature_is_hex_and_depends_on_parameters() {
    let mut rng = ChaCha8Rng::seed_from_u64(10);
    let first = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let second = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let signature_a = first.signature.clone().unwrap();
    let signature_b = second.signature.clone().unwrap();
    assert_eq!(signature_a.len(), 64);
    assert!(signature_a.chars().all(|c| c.is_ascii_hexdigit()));
    assert_ne!(signature_a, signature_b);
}

#[test]
fn altcha_valid_at_exact_expiry_only() {
    let mut rng = ChaCha8Rng::seed_from_u64(11);
    let challenge = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let expires =
        u64::try_from(challenge.parameters.as_ref().unwrap().expires_at.unwrap()).unwrap();
    let payload = solve(&challenge);
    assert!(verify_altcha(&payload, SECRET, expires).unwrap());
    assert!(!verify_altcha(&payload, SECRET, expires + 1).unwrap());
}

#[test]
fn altcha_v2_rejects_solution_below_prefix() {
    let mut rng = ChaCha8Rng::seed_from_u64(3);
    let challenge = create_altcha_challenge(&mut rng, SECRET, NOW, COST).unwrap();
    let parameters = challenge.parameters.as_ref().unwrap().clone();
    let nonce = hex::decode(&parameters.nonce).unwrap();
    let salt = hex::decode(&parameters.salt).unwrap();
    assert_ne!(parameters.key_prefix, "");

    let mut payload = solve(&challenge);
    let mut counter: u32 = 0;
    let derived = loop {
        let derived = derive_hex(
            &nonce,
            counter,
            &salt,
            parameters.cost,
            parameters.key_length,
        );
        if !derived.starts_with(&parameters.key_prefix) {
            break derived;
        }
        counter += 1;
    };
    if let Some(solution) = payload.solution.as_mut() {
        solution.counter = counter;
        solution.derived_key = derived;
    }
    assert!(!verify_altcha(&payload, SECRET, NOW + 1).unwrap());
}
