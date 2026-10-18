use std::collections::BTreeMap;

use hmac::{Hmac, Mac};
use pbkdf2::pbkdf2_hmac;
use rand::{CryptoRng, RngCore};
use sha2::Sha256;

use auth_proto::auth::v1::{AltchaChallenge, AltchaParameters, AltchaPayload};

use crate::codes::constant_time_equal;
use crate::error::AuthError;

pub const ALTCHA_COST: u32 = 5_000;

const ALGORITHM: &str = "PBKDF2/SHA-256";
const KEY_LENGTH: u32 = 32;
const KEY_PREFIX: &str = "00";
const TTL_SECS: i64 = 600;

type HmacSha256 = Hmac<Sha256>;

fn hmac_hex(secret: &str, data: &[u8]) -> Result<String, AuthError> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes()).map_err(|_| AuthError::Internal)?;
    mac.update(data);
    Ok(hex::encode(mac.finalize().into_bytes()))
}

fn canonical(parameters: &AltchaParameters) -> Result<String, AuthError> {
    let mut map: BTreeMap<&str, serde_json::Value> = BTreeMap::new();
    map.insert("algorithm", serde_json::json!(parameters.algorithm.clone()));
    map.insert("cost", serde_json::json!(parameters.cost));
    if let Some(expires) = parameters.expires_at {
        map.insert("expiresAt", serde_json::json!(expires));
    }
    map.insert("keyLength", serde_json::json!(parameters.key_length));
    map.insert(
        "keyPrefix",
        serde_json::json!(parameters.key_prefix.clone()),
    );
    if let Some(signature) = &parameters.key_signature {
        map.insert("keySignature", serde_json::json!(signature.clone()));
    }
    if let Some(memory) = parameters.memory_cost {
        map.insert("memoryCost", serde_json::json!(memory));
    }
    map.insert("nonce", serde_json::json!(parameters.nonce.clone()));
    if let Some(parallelism) = parameters.parallelism {
        map.insert("parallelism", serde_json::json!(parallelism));
    }
    map.insert("salt", serde_json::json!(parameters.salt.clone()));
    serde_json::to_string(&map).map_err(|_| AuthError::Internal)
}

fn password(nonce: &[u8], counter: u32) -> Vec<u8> {
    let mut buf = Vec::with_capacity(nonce.len() + 4);
    buf.extend_from_slice(nonce);
    buf.extend_from_slice(&counter.to_be_bytes());
    buf
}

fn derive(password: &[u8], salt: &[u8], cost: u32, key_length: u32) -> Vec<u8> {
    let mut out = vec![0u8; key_length as usize];
    pbkdf2_hmac::<Sha256>(password, salt, cost, &mut out);
    out
}

pub fn create_challenge<R: RngCore + CryptoRng>(
    rng: &mut R,
    secret: &str,
    now: u64,
    cost: u32,
) -> Result<AltchaChallenge, AuthError> {
    let mut nonce = [0u8; 16];
    rng.fill_bytes(&mut nonce);
    let mut salt = [0u8; 16];
    rng.fill_bytes(&mut salt);
    let parameters = AltchaParameters {
        algorithm: ALGORITHM.to_string(),
        cost,
        expires_at: Some(i64::try_from(now).unwrap_or(0).saturating_add(TTL_SECS)),
        key_length: KEY_LENGTH,
        key_prefix: KEY_PREFIX.to_string(),
        key_signature: None,
        memory_cost: None,
        nonce: hex::encode(nonce),
        parallelism: None,
        salt: hex::encode(salt),
    };
    let signature = hmac_hex(secret, canonical(&parameters)?.as_bytes())?;
    Ok(AltchaChallenge {
        parameters: Some(parameters),
        signature: Some(signature),
    })
}

pub fn verify_solution(payload: &AltchaPayload, secret: &str, now: u64) -> Result<bool, AuthError> {
    let Some(challenge) = payload.challenge.as_ref() else {
        return Ok(false);
    };
    let Some(parameters) = challenge.parameters.as_ref() else {
        return Ok(false);
    };
    if !parameters.algorithm.eq_ignore_ascii_case(ALGORITHM) {
        return Ok(false);
    }
    if let Some(expires) = parameters.expires_at {
        if expires != 0 && now > u64::try_from(expires).unwrap_or(0) {
            return Ok(false);
        }
    }
    let signature = challenge.signature.as_deref().unwrap_or_default();
    if signature.is_empty() {
        return Ok(false);
    }
    let expected = hmac_hex(secret, canonical(parameters)?.as_bytes())?;
    if !constant_time_equal(signature.as_bytes(), expected.as_bytes()) {
        return Ok(false);
    }
    let Some(solution) = payload.solution.as_ref() else {
        return Ok(false);
    };
    let Ok(nonce) = hex::decode(&parameters.nonce) else {
        return Ok(false);
    };
    let Ok(salt) = hex::decode(&parameters.salt) else {
        return Ok(false);
    };
    let derived = derive(
        &password(&nonce, solution.counter),
        &salt,
        parameters.cost,
        parameters.key_length,
    );
    let derived_hex = hex::encode(&derived);
    if !constant_time_equal(derived_hex.as_bytes(), solution.derived_key.as_bytes()) {
        return Ok(false);
    }
    Ok(derived_hex.starts_with(&parameters.key_prefix.to_lowercase()))
}
