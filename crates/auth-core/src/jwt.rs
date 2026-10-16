use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};

use auth_proto::auth::v1::{AccessClaims, IdTokenClaims};

use crate::error::AuthError;

pub const ACCESS_TOKEN_TTL: u64 = 900;
pub const ID_TOKEN_TTL: u64 = 3600;

pub struct AccessInput {
    pub sub: String,
    pub email: String,
    pub role: String,
    pub session_id: Option<String>,
    pub issuer: String,
    pub issued_at: u64,
    pub jti: String,
}

pub struct IdInput {
    pub sub: String,
    pub email: String,
    pub audience: Option<String>,
    pub issuer: String,
    pub issued_at: u64,
    pub jti: String,
}

fn header() -> Header {
    Header::new(Algorithm::RS256)
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
