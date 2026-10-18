use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use sha2::{Digest, Sha256};

use auth_proto::auth::v1::{AccessClaims, IdTokenClaims};

use crate::error::AuthError;

pub const ACCESS_TOKEN_TTL: u64 = 900;
pub const ID_TOKEN_TTL: u64 = 3600;

// Static key id, mirrored in the JWKS document. Rotation adds a second id.
pub const KEY_ID: &str = "neo-auth-rs256";

pub struct AccessInput {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub session_id: Option<String>,
    pub issuer: String,
    pub issued_at: u64,
    pub auth_time: u64,
    pub scope: String,
    pub jti: String,
}

pub struct IdInput {
    pub sub: String,
    pub email: String,
    pub audience: String,
    pub issuer: String,
    pub issued_at: u64,
    pub auth_time: u64,
    pub nonce: Option<String>,
    pub access_token: Option<String>,
    pub jti: String,
}

fn header() -> Header {
    let mut header = Header::new(Algorithm::RS256);
    header.kid = Some(KEY_ID.to_string());
    header
}

#[must_use]
pub fn at_hash(access_token: &str) -> String {
    let digest = Sha256::digest(access_token.as_bytes());
    URL_SAFE_NO_PAD.encode(&digest[..16])
}

pub fn sign_access(private_pem: &[u8], input: &AccessInput) -> Result<String, AuthError> {
    let key = EncodingKey::from_rsa_pem(private_pem).map_err(|_| AuthError::Internal)?;
    let claims = AccessClaims {
        sub: input.sub.clone(),
        email: input.email.clone(),
        role: input.role.clone(),
        session_id: input.session_id.clone(),
        iss: input.issuer.clone(),
        iat_unix: i64::try_from(input.issued_at).unwrap_or(0),
        exp_unix: i64::try_from(input.issued_at.saturating_add(ACCESS_TOKEN_TTL))
            .unwrap_or(i64::MAX),
        jti: input.jti.clone(),
        auth_time_unix: (input.auth_time > 0).then(|| i64::try_from(input.auth_time).unwrap_or(0)),
        scope: (!input.scope.is_empty()).then(|| input.scope.clone()),
    };
    encode(&header(), &claims, &key).map_err(|_| AuthError::Internal)
}

pub fn sign_id(private_pem: &[u8], input: &IdInput) -> Result<String, AuthError> {
    let key = EncodingKey::from_rsa_pem(private_pem).map_err(|_| AuthError::Internal)?;
    let claims = IdTokenClaims {
        sub: input.sub.clone(),
        email: input.email.clone(),
        name: input.email.clone(),
        aud: input.audience.clone(),
        iss: input.issuer.clone(),
        iat_unix: i64::try_from(input.issued_at).unwrap_or(0),
        exp_unix: i64::try_from(input.issued_at.saturating_add(ID_TOKEN_TTL)).unwrap_or(i64::MAX),
        jti: input.jti.clone(),
        nonce: input.nonce.clone(),
        at_hash: input.access_token.as_deref().map(at_hash),
        auth_time_unix: (input.auth_time > 0).then(|| i64::try_from(input.auth_time).unwrap_or(0)),
    };
    encode(&header(), &claims, &key).map_err(|_| AuthError::Internal)
}

pub fn verify_access(
    public_pem: &[u8],
    token: &str,
    issuer: &str,
    now: u64,
) -> Result<AccessClaims, AuthError> {
    let key = DecodingKey::from_rsa_pem(public_pem).map_err(|_| AuthError::Internal)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = false;
    validation.set_issuer(&[issuer]);
    validation.set_required_spec_claims(&["exp", "iss", "sub"]);
    let claims = decode::<AccessClaims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(map_jwt_error)?;
    if claims.exp_unix <= i64::try_from(now).unwrap_or(i64::MAX) {
        return Err(AuthError::InvalidCredentials);
    }
    Ok(claims)
}

pub fn verify_id(
    public_pem: &[u8],
    token: &str,
    issuer: &str,
    now: u64,
) -> Result<IdTokenClaims, AuthError> {
    let key = DecodingKey::from_rsa_pem(public_pem).map_err(|_| AuthError::Internal)?;
    let mut validation = Validation::new(Algorithm::RS256);
    validation.validate_exp = false;
    validation.validate_aud = false;
    validation.set_issuer(&[issuer]);
    validation.set_required_spec_claims(&["exp", "iss", "sub"]);
    let claims = decode::<IdTokenClaims>(token, &key, &validation)
        .map(|data| data.claims)
        .map_err(map_jwt_error)?;
    if claims.exp_unix <= i64::try_from(now).unwrap_or(i64::MAX) {
        return Err(AuthError::InvalidCredentials);
    }
    Ok(claims)
}

fn map_jwt_error(err: jsonwebtoken::errors::Error) -> AuthError {
    use jsonwebtoken::errors::ErrorKind as Kind;
    match err.into_kind() {
        Kind::InvalidToken
        | Kind::InvalidAlgorithmName
        | Kind::MissingRequiredClaim(_)
        | Kind::InvalidClaimFormat(_)
        | Kind::Base64(_)
        | Kind::Json(_)
        | Kind::Utf8(_) => AuthError::MalformedMessage,
        Kind::InvalidSignature
        | Kind::ExpiredSignature
        | Kind::InvalidIssuer
        | Kind::InvalidAudience
        | Kind::InvalidSubject
        | Kind::ImmatureSignature
        | Kind::InvalidAlgorithm => AuthError::InvalidCredentials,
        Kind::InvalidEcdsaKey
        | Kind::InvalidEddsaKey
        | Kind::InvalidRsaKey(_)
        | Kind::RsaFailedSigning
        | Kind::Signing(_)
        | Kind::UnsupportedAlgorithm
        | Kind::InvalidKeyFormat
        | Kind::MissingAlgorithm
        | Kind::Provider(_)
        | _ => AuthError::Internal,
    }
}
