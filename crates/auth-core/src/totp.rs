use rand::{CryptoRng, RngCore};
use totp_rs::{Algorithm, Secret, TOTP};

use crate::error::AuthError;

fn authenticator(secret_base32: &str, account: &str) -> Result<TOTP, AuthError> {
    let secret = Secret::Encoded(secret_base32.to_string())
        .to_bytes()
        .map_err(|_| AuthError::MalformedMessage)?;
    TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        secret,
        Some("Neo ID".to_string()),
        account.to_string(),
    )
    .map_err(|_| AuthError::MalformedMessage)
}

pub fn generate_secret<R: RngCore + CryptoRng>(rng: &mut R) -> Result<String, AuthError> {
    let mut raw = [0u8; 20];
    rng.fill_bytes(&mut raw);
    TOTP::new(
        Algorithm::SHA1,
        6,
        1,
        30,
        raw.to_vec(),
        Some("Neo ID".to_string()),
        String::new(),
    )
    .map(|totp| totp.get_secret_base32())
    .map_err(|_| AuthError::Internal)
}

pub fn setup_uri(secret_base32: &str, account: &str) -> Result<String, AuthError> {
    authenticator(secret_base32, account).map(|totp| totp.get_url())
}

pub fn verify_totp(secret_base32: &str, token: &str, unix_time: u64) -> Result<bool, AuthError> {
    authenticator(secret_base32, "").map(|totp| totp.check(token, unix_time))
}
