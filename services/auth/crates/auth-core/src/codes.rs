use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::{CryptoRng, Rng, RngCore};
use sha2::{Digest, Sha256};
use subtle::ConstantTimeEq;
use uuid::Builder;

pub fn generate_token<R: RngCore + CryptoRng>(rng: &mut R, byte_len: usize) -> String {
    let mut bytes = vec![0u8; byte_len];
    rng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

#[must_use]
pub fn hash_token(token: &str) -> String {
    hex::encode(Sha256::digest(token.as_bytes()))
}

#[must_use]
pub fn generate_id<R: RngCore + CryptoRng>(rng: &mut R) -> String {
    let mut bytes = [0u8; 16];
    rng.fill_bytes(&mut bytes);
    Builder::from_random_bytes(bytes).into_uuid().to_string()
}

#[must_use]
pub fn generate_code<R: Rng + CryptoRng>(rng: &mut R, digits: usize) -> String {
    (0..digits)
        .map(|_| char::from(b'0' + rng.gen_range(0..10u8)))
        .collect()
}

#[must_use]
pub fn constant_time_equal(a: &[u8], b: &[u8]) -> bool {
    a.ct_eq(b).into()
}
