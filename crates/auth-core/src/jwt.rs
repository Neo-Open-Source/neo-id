use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use jsonwebtoken::{Algorithm, DecodingKey, EncodingKey, Header, Validation, decode, encode};
use sha2::{Digest, Sha256};

use auth_proto::auth::v1::{AccessClaims, IdTokenClaims};

use crate::error::AuthError;

pub const ACCESS_TOKEN_TTL: u64 = 900;
pub const ID_TOKEN_TTL: u64 = 3600;

// Static key ids, mirrored in the JWKS document. Rotation adds a second id per alg.
pub const KEY_ID: &str = "neo-auth-rs256";
pub const EC_KEY_ID: &str = "neo-auth-es256";

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
#[non_exhaustive]
pub enum SigningAlg {
    Rs256,
    Es256,
}

impl SigningAlg {
    #[must_use]
    pub fn kid(self) -> &'static str {
        match self {
            Self::Rs256 => KEY_ID,
            Self::Es256 => EC_KEY_ID,
        }
    }

    #[must_use]
    pub fn name(self) -> &'static str {
        match self {
            Self::Rs256 => "RS256",
            Self::Es256 => "ES256",
        }
    }

    fn jwa(self) -> Algorithm {
        match self {
            Self::Rs256 => Algorithm::RS256,
            Self::Es256 => Algorithm::ES256,
        }
    }
}

pub struct SigningKey {
    alg: SigningAlg,
    pem: Vec<u8>,
}

impl SigningKey {
    #[must_use]
    pub fn new(alg: SigningAlg, pem: impl Into<Vec<u8>>) -> Self {
        Self {
            alg,
            pem: pem.into(),
        }
    }

    #[must_use]
    pub fn alg(&self) -> SigningAlg {
        self.alg
    }

    fn encoding(&self) -> Result<EncodingKey, AuthError> {
        match self.alg {
            SigningAlg::Rs256 => {
                EncodingKey::from_rsa_pem(&self.pem).map_err(|_| AuthError::Internal)
            }
            SigningAlg::Es256 => {
                EncodingKey::from_ec_pem(&self.pem).map_err(|_| AuthError::Internal)
            }
        }
    }
}

impl core::fmt::Debug for SigningKey {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        formatter
            .debug_struct("SigningKey")
            .field("alg", &self.alg)
            .finish_non_exhaustive()
    }
}

pub struct VerifyKey {
    alg: SigningAlg,
    pem: Vec<u8>,
}

impl VerifyKey {
    #[must_use]
    pub fn new(alg: SigningAlg, pem: impl Into<Vec<u8>>) -> Self {
        Self {
            alg,
            pem: pem.into(),
        }
    }

    #[must_use]
    pub fn alg(&self) -> SigningAlg {
        self.alg
    }

    fn decoding(&self) -> Result<DecodingKey, AuthError> {
        match self.alg {
            SigningAlg::Rs256 => {
                DecodingKey::from_rsa_pem(&self.pem).map_err(|_| AuthError::Internal)
            }
            SigningAlg::Es256 => {
                DecodingKey::from_ec_pem(&self.pem).map_err(|_| AuthError::Internal)
            }
        }
    }
}

impl core::fmt::Debug for VerifyKey {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        formatter
            .debug_struct("VerifyKey")
            .field("alg", &self.alg)
            .finish_non_exhaustive()
    }
}

// Overlapping key set: verification accepts any configured key so tokens signed
// before a signing-algorithm switch keep validating until they expire.
pub struct KeyRing {
    keys: Vec<VerifyKey>,
}

impl KeyRing {
    #[must_use]
    pub fn new(keys: Vec<VerifyKey>) -> Self {
        Self { keys }
    }

    fn candidates(&self, alg: SigningAlg) -> impl Iterator<Item = &VerifyKey> {
        self.keys.iter().filter(move |key| key.alg == alg)
    }
}

impl core::fmt::Debug for KeyRing {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        formatter
            .debug_struct("KeyRing")
            .field("len", &self.keys.len())
            .finish()
    }
}

fn signing_alg(alg: Algorithm) -> Option<SigningAlg> {
    match alg {
        Algorithm::RS256 => Some(SigningAlg::Rs256),
        Algorithm::ES256 => Some(SigningAlg::Es256),
        _ => None,
    }
}

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

fn header(alg: SigningAlg) -> Header {
    let mut header = Header::new(alg.jwa());
    header.kid = Some(alg.kid().to_string());
    header
}

#[must_use]
pub fn at_hash(access_token: &str) -> String {
    let digest = Sha256::digest(access_token.as_bytes());
    URL_SAFE_NO_PAD.encode(&digest[..16])
}

pub fn sign_access(key: &SigningKey, input: &AccessInput) -> Result<String, AuthError> {
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
    encode(&header(key.alg), &claims, &key.encoding()?).map_err(|_| AuthError::Internal)
}

pub fn sign_id(key: &SigningKey, input: &IdInput) -> Result<String, AuthError> {
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
    encode(&header(key.alg), &claims, &key.encoding()?).map_err(|_| AuthError::Internal)
}

pub fn verify_access(
    keys: &KeyRing,
    token: &str,
    issuer: &str,
    now: u64,
) -> Result<AccessClaims, AuthError> {
    let header = jsonwebtoken::decode_header(token).map_err(map_jwt_error)?;
    let alg = signing_alg(header.alg).ok_or(AuthError::InvalidCredentials)?;
    let mut last = AuthError::InvalidCredentials;
    for key in keys.candidates(alg) {
        match decode_access(key, token, issuer, now) {
            Ok(claims) => return Ok(claims),
            Err(err) => last = err,
        }
    }
    Err(last)
}

pub fn verify_id(
    keys: &KeyRing,
    token: &str,
    issuer: &str,
    now: u64,
) -> Result<IdTokenClaims, AuthError> {
    let header = jsonwebtoken::decode_header(token).map_err(map_jwt_error)?;
    let alg = signing_alg(header.alg).ok_or(AuthError::InvalidCredentials)?;
    let mut last = AuthError::InvalidCredentials;
    for key in keys.candidates(alg) {
        match decode_id(key, token, issuer, now) {
            Ok(claims) => return Ok(claims),
            Err(err) => last = err,
        }
    }
    Err(last)
}

fn decode_access(
    key: &VerifyKey,
    token: &str,
    issuer: &str,
    now: u64,
) -> Result<AccessClaims, AuthError> {
    let mut validation = Validation::new(key.alg.jwa());
    validation.validate_exp = false;
    validation.set_issuer(&[issuer]);
    validation.set_required_spec_claims(&["exp", "iss", "sub"]);
    let claims = decode::<AccessClaims>(token, &key.decoding()?, &validation)
        .map(|data| data.claims)
        .map_err(map_jwt_error)?;
    if claims.exp_unix <= i64::try_from(now).unwrap_or(i64::MAX) {
        return Err(AuthError::InvalidCredentials);
    }
    Ok(claims)
}

fn decode_id(
    key: &VerifyKey,
    token: &str,
    issuer: &str,
    now: u64,
) -> Result<IdTokenClaims, AuthError> {
    let mut validation = Validation::new(key.alg.jwa());
    validation.validate_exp = false;
    validation.validate_aud = false;
    validation.set_issuer(&[issuer]);
    validation.set_required_spec_claims(&["exp", "iss", "sub"]);
    let claims = decode::<IdTokenClaims>(token, &key.decoding()?, &validation)
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
