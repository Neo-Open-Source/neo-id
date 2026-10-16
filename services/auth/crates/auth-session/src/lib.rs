#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

use auth_core::AuthError;
use hmac::{Hmac, Mac};
use sha2::Sha256;
use subtle::ConstantTimeEq;

fn signer(secret: &[u8]) -> Result<Hmac<Sha256>, AuthError> {
    if secret.is_empty() {
        return Err(AuthError::Internal);
    }
    Hmac::new_from_slice(secret).map_err(|_| AuthError::Internal)
}

fn signature(secret: &[u8], session_id: &str, exp: u64) -> Result<Vec<u8>, AuthError> {
    let mut mac = signer(secret)?;
    mac.update(session_id.as_bytes());
    mac.update(b".");
    mac.update(exp.to_string().as_bytes());
    Ok(mac.finalize().into_bytes().to_vec())
}

pub fn issue_cookie(
    secret: &[u8],
    session_id: &str,
    ttl: u64,
    now: u64,
) -> Result<String, AuthError> {
    let exp = now + ttl;
    Ok(format!(
        "{session_id}.{exp}.{}",
        hex::encode(signature(secret, session_id, exp)?)
    ))
}

pub fn verify_cookie(secret: &[u8], cookie: &str, now: u64) -> Result<String, AuthError> {
    let mut parts = cookie.split('.');
    let (Some(session_id), Some(exp), Some(sig), None) =
        (parts.next(), parts.next(), parts.next(), parts.next())
    else {
        return Err(AuthError::MalformedMessage);
    };
    let exp: u64 = exp.parse().map_err(|_| AuthError::MalformedMessage)?;
    let expected = signature(secret, session_id, exp)?;
    let presented = hex::decode(sig).map_err(|_| AuthError::MalformedMessage)?;
    if expected.as_slice().ct_eq(presented.as_slice()).unwrap_u8() == 1 && exp > now {
        Ok(session_id.to_string())
    } else {
        Err(AuthError::InvalidCredentials)
    }
}
