use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::{CryptoRng, RngCore};
use sha2::{Digest, Sha256};

use crate::{codes::constant_time_equal, error::AuthError};

#[must_use]
pub fn pkce_challenge(verifier: &str) -> String {
    URL_SAFE_NO_PAD.encode(Sha256::digest(verifier.as_bytes()))
}

#[must_use]
pub fn generate_verifier<R: RngCore + CryptoRng>(rng: &mut R) -> String {
    let mut bytes = [0u8; 32];
    rng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

#[must_use]
pub fn verify_pkce(verifier: &str, expected_challenge: &str) -> bool {
    constant_time_equal(
        pkce_challenge(verifier).as_bytes(),
        expected_challenge.as_bytes(),
    )
}

pub fn enforce_pkce(
    stored_challenge: Option<&str>,
    is_public_client: bool,
    verifier: Option<&str>,
) -> Result<(), AuthError> {
    let Some(expected) = stored_challenge else {
        return if is_public_client {
            Err(AuthError::InvalidCredentials)
        } else {
            Ok(())
        };
    };
    let Some(presented) = verifier else {
        return Err(AuthError::InvalidCredentials);
    };
    if verify_pkce(presented, expected) {
        Ok(())
    } else {
        Err(AuthError::InvalidCredentials)
    }
}
