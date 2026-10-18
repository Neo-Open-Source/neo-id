use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use p256::PublicKey;
use rsa::{RsaPublicKey, pkcs8::DecodePublicKey, traits::PublicKeyParts};

use crate::error::AuthError;
use crate::jwt::{EC_KEY_ID, KEY_ID, SigningAlg};

pub fn rs256(public_pem: &[u8]) -> Result<serde_json::Value, AuthError> {
    let text = core::str::from_utf8(public_pem).map_err(|_| AuthError::Internal)?;
    let key = RsaPublicKey::from_public_key_pem(text).map_err(|_| AuthError::Internal)?;
    Ok(serde_json::json!({
        "kty": "RSA",
        "n": URL_SAFE_NO_PAD.encode(key.n().to_bytes_be()),
        "e": URL_SAFE_NO_PAD.encode(key.e().to_bytes_be()),
        "alg": SigningAlg::Rs256.name(),
        "use": "sig",
        "kid": KEY_ID,
    }))
}

pub fn es256(public_pem: &[u8]) -> Result<serde_json::Value, AuthError> {
    let text = core::str::from_utf8(public_pem).map_err(|_| AuthError::Internal)?;
    let key = PublicKey::from_public_key_pem(text).map_err(|_| AuthError::Internal)?;
    let point = key.to_sec1_bytes();
    let x = point.get(1..33).ok_or(AuthError::Internal)?;
    let y = point.get(33..65).ok_or(AuthError::Internal)?;
    Ok(serde_json::json!({
        "kty": "EC",
        "crv": "P-256",
        "x": URL_SAFE_NO_PAD.encode(x),
        "y": URL_SAFE_NO_PAD.encode(y),
        "alg": SigningAlg::Es256.name(),
        "use": "sig",
        "kid": EC_KEY_ID,
    }))
}

#[cfg(test)]
mod tests {
    use super::{es256, rs256};

    const RSA_PUB: &[u8] = include_bytes!("../tests/data/test-rsa.pub.pem");
    const EC_PUB: &[u8] = include_bytes!("../tests/data/test-ec.pub.pem");

    #[test]
    fn rs256_jwk_exposes_modulus_and_exponent() {
        let jwk = rs256(RSA_PUB).unwrap();
        assert_eq!(jwk["kty"], "RSA");
        assert_eq!(jwk["alg"], "RS256");
        assert_eq!(jwk["e"], "AQAB");
        assert_eq!(jwk["kid"], "neo-auth-rs256");
        assert_ne!(jwk["n"].as_str().unwrap_or_default(), "");
    }

    #[test]
    fn es256_jwk_exposes_p256_point() {
        let jwk = es256(EC_PUB).unwrap();
        assert_eq!(jwk["kty"], "EC");
        assert_eq!(jwk["crv"], "P-256");
        assert_eq!(jwk["alg"], "ES256");
        assert_eq!(jwk["kid"], "neo-auth-es256");
        assert_eq!(jwk["x"].as_str().map(str::len), Some(43));
        assert_eq!(jwk["y"].as_str().map(str::len), Some(43));
    }

    #[test]
    fn malformed_pem_is_internal() {
        assert!(rs256(b"nope").is_err());
        assert!(es256(b"nope").is_err());
    }
}
