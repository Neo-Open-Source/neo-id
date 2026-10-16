use std::collections::BTreeMap;

use serde_cbor_2::Value;
use sha2::{Digest, Sha256};
use webauthn_rs::prelude::{
    Passkey, PasskeyAuthentication, PasskeyRegistration, Url, Uuid, Webauthn, WebauthnBuilder,
    WebauthnError,
};
use webauthn_rs_core::proto::{
    AttestationFormat, AttestationMetadata, AuthenticatorTransport, COSEAlgorithm, COSEKey,
    COSEKeyType, Credential, ECDSACurve, EDDSACurve, ParsedAttestation, ParsedAttestationData,
    PublicKeyCredential, RegisterPublicKeyCredential, RegisteredExtensions, UserVerificationPolicy,
};

use crate::error::AuthError;

pub use webauthn_rs_core::proto::{CreationChallengeResponse, RequestChallengeResponse};

#[derive(Debug, Clone)]
pub struct PasskeyRp {
    inner: Webauthn,
}

impl PasskeyRp {
    pub fn new(rp_id: &str, origin: &str) -> Result<Self, AuthError> {
        let origin = Url::parse(origin).map_err(|_| AuthError::Internal)?;
        let inner = WebauthnBuilder::new(rp_id, &origin)
            .map_err(|_| AuthError::Internal)?
            .rp_name("Neo ID")
            .build()
            .map_err(|_| AuthError::Internal)?;
        Ok(Self { inner })
    }
}

#[must_use]
pub fn user_uuid(user_id: &str) -> Uuid {
    let hash = Sha256::digest(user_id.as_bytes());
    let mut bytes = [0u8; 16];
    for (dst, src) in bytes.iter_mut().zip(hash.iter()) {
        *dst = *src;
    }
    Uuid::from_bytes(bytes)
}

#[derive(Debug, Clone)]
pub struct RegistrationState(PasskeyRegistration);

#[derive(Debug, Clone)]
pub struct AuthenticationState(PasskeyAuthentication);

impl RegistrationState {
    pub fn to_bytes(&self) -> Result<Vec<u8>, AuthError> {
        serde_json::to_vec(&self.0).map_err(|_| AuthError::Internal)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, AuthError> {
        serde_json::from_slice(bytes)
            .map(Self)
            .map_err(|_| AuthError::MalformedMessage)
    }
}

impl AuthenticationState {
    pub fn to_bytes(&self) -> Result<Vec<u8>, AuthError> {
        serde_json::to_vec(&self.0).map_err(|_| AuthError::Internal)
    }

    pub fn from_bytes(bytes: &[u8]) -> Result<Self, AuthError> {
        serde_json::from_slice(bytes)
            .map(Self)
            .map_err(|_| AuthError::MalformedMessage)
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct StoredCredential {
    pub id: Vec<u8>,
    pub key: Vec<u8>,
    pub counter: u32,
    pub transports: Vec<String>,
    pub backup_eligible: bool,
    pub backup_state: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct VerifiedAuthentication {
    pub credential_id: Vec<u8>,
    pub counter: u32,
}

pub fn registration_options(
    rp: &PasskeyRp,
    user_id: Uuid,
    user_name: &str,
    exclude: &[StoredCredential],
) -> Result<(CreationChallengeResponse, RegistrationState), AuthError> {
    let excluded = exclude
        .iter()
        .map(|credential| credential.id.clone().into())
        .collect::<Vec<_>>();
    let excluded = if excluded.is_empty() {
        None
    } else {
        Some(excluded)
    };
    rp.inner
        .start_passkey_registration(user_id, user_name, user_name, excluded)
        .map(|(options, state)| (options, RegistrationState(state)))
        .map_err(AuthError::from)
}

pub fn verify_registration(
    rp: &PasskeyRp,
    response_json: &str,
    state: &RegistrationState,
) -> Result<StoredCredential, AuthError> {
    let response: RegisterPublicKeyCredential =
        serde_json::from_str(response_json).map_err(|_| AuthError::MalformedMessage)?;
    let credential: Credential = rp
        .inner
        .finish_passkey_registration(&response, &state.0)
        .map_err(AuthError::from)?
        .into();
    Ok(StoredCredential {
        id: credential.cred_id.as_slice().to_vec(),
        key: cose_bytes(&credential.cred)?,
        counter: credential.counter,
        transports: response
            .response
            .transports
            .unwrap_or_default()
            .into_iter()
            .filter_map(|transport| match transport {
                AuthenticatorTransport::Unknown => None,
                known => Some(known.as_ref().to_owned()),
            })
            .collect(),
        backup_eligible: credential.backup_eligible,
        backup_state: credential.backup_state,
    })
}

pub fn authentication_options(
    rp: &PasskeyRp,
    credentials: &[StoredCredential],
) -> Result<(RequestChallengeResponse, AuthenticationState), AuthError> {
    if credentials.is_empty() {
        return Err(AuthError::MalformedMessage);
    }
    let passkeys = credentials
        .iter()
        .map(|stored| {
            let value: Value =
                serde_cbor_2::from_slice(&stored.key).map_err(|_| AuthError::MalformedMessage)?;
            let key = COSEKey::try_from(&value).map_err(AuthError::from)?;
            let transports = stored
                .transports
                .iter()
                .filter_map(|transport| transport.parse::<AuthenticatorTransport>().ok())
                .collect::<Vec<_>>();
            Ok(Passkey::from(Credential {
                cred_id: stored.id.clone().into(),
                cred: key,
                counter: stored.counter,
                transports: if transports.is_empty() {
                    None
                } else {
                    Some(transports)
                },
                user_verified: false,
                backup_eligible: stored.backup_eligible,
                backup_state: stored.backup_state,
                registration_policy: UserVerificationPolicy::Required,
                extensions: RegisteredExtensions::none(),
                attestation: ParsedAttestation {
                    data: ParsedAttestationData::None,
                    metadata: AttestationMetadata::None,
                },
                attestation_format: AttestationFormat::None,
            }))
        })
        .collect::<Result<Vec<_>, AuthError>>()?;
    rp.inner
        .start_passkey_authentication(&passkeys)
        .map(|(options, state)| (options, AuthenticationState(state)))
        .map_err(AuthError::from)
}

pub fn verify_authentication(
    rp: &PasskeyRp,
    response_json: &str,
    state: &AuthenticationState,
) -> Result<VerifiedAuthentication, AuthError> {
    let response: PublicKeyCredential =
        serde_json::from_str(response_json).map_err(|_| AuthError::MalformedMessage)?;
    let result = rp
        .inner
        .finish_passkey_authentication(&response, &state.0)
        .map_err(AuthError::from)?;
    Ok(VerifiedAuthentication {
        credential_id: result.cred_id().as_slice().to_vec(),
        counter: result.counter(),
    })
}

pub(crate) fn cose_bytes(key: &COSEKey) -> Result<Vec<u8>, AuthError> {
    let algorithm = match key.type_ {
        COSEAlgorithm::ES256 => -7,
        COSEAlgorithm::ES384 => -35,
        COSEAlgorithm::ES512 => -36,
        COSEAlgorithm::RS256 => -257,
        COSEAlgorithm::EDDSA => -8,
        COSEAlgorithm::RS384
        | COSEAlgorithm::RS512
        | COSEAlgorithm::PS256
        | COSEAlgorithm::PS384
        | COSEAlgorithm::PS512
        | COSEAlgorithm::INSECURE_RS1
        | COSEAlgorithm::PinUvProtocol => return Err(AuthError::Internal),
    };
    let mut map = BTreeMap::new();
    match &key.key {
        COSEKeyType::EC_EC2(key) => {
            let curve = match key.curve {
                ECDSACurve::SECP256R1 => 1,
                ECDSACurve::SECP384R1 => 2,
                ECDSACurve::SECP521R1 => 3,
            };
            map.insert(Value::Integer(1), Value::Integer(2));
            map.insert(Value::Integer(3), Value::Integer(algorithm));
            map.insert(Value::Integer(-1), Value::Integer(curve));
            map.insert(Value::Integer(-2), Value::Bytes(key.x.as_slice().to_vec()));
            map.insert(Value::Integer(-3), Value::Bytes(key.y.as_slice().to_vec()));
        }
        COSEKeyType::EC_OKP(key) => {
            let curve = match key.curve {
                EDDSACurve::ED25519 => 6,
                EDDSACurve::ED448 => 7,
            };
            map.insert(Value::Integer(1), Value::Integer(1));
            map.insert(Value::Integer(3), Value::Integer(algorithm));
            map.insert(Value::Integer(-1), Value::Integer(curve));
            map.insert(Value::Integer(-2), Value::Bytes(key.x.as_slice().to_vec()));
        }
        COSEKeyType::RSA(key) => {
            map.insert(Value::Integer(1), Value::Integer(3));
            map.insert(Value::Integer(3), Value::Integer(algorithm));
            map.insert(Value::Integer(-1), Value::Bytes(key.n.as_slice().to_vec()));
            map.insert(Value::Integer(-2), Value::Bytes(key.e.to_vec()));
        }
    }
    serde_cbor_2::to_vec(&Value::Map(map)).map_err(|_| AuthError::Internal)
}

impl From<WebauthnError> for AuthError {
    fn from(error: WebauthnError) -> Self {
        match error {
            WebauthnError::MismatchedChallenge
            | WebauthnError::ChallengeNotFound
            | WebauthnError::InvalidRPOrigin
            | WebauthnError::InvalidRPIDHash
            | WebauthnError::UserNotPresent
            | WebauthnError::UserNotVerified
            | WebauthnError::InvalidExtensions
            | WebauthnError::AuthenticatorDataMissingExtension
            | WebauthnError::AttestationNotSupported
            | WebauthnError::AttestationStatementMapInvalid
            | WebauthnError::AttestationStatementResponseMissing
            | WebauthnError::AttestationStatementResponseInvalid
            | WebauthnError::AttestationStatementSigMissing
            | WebauthnError::AttestationStatementSigInvalid
            | WebauthnError::AttestationStatementVerMissing
            | WebauthnError::AttestationStatementVerInvalid
            | WebauthnError::AttestationStatementVerUnsupported
            | WebauthnError::AttestationStatementX5CMissing
            | WebauthnError::AttestationStatementX5CInvalid
            | WebauthnError::AttestationStatementAlgMissing
            | WebauthnError::AttestationStatementCertInfoMissing
            | WebauthnError::AttestationStatementMissingExtension
            | WebauthnError::AttestationStatementPubAreaMissing
            | WebauthnError::AttestationStatementAlgMismatch
            | WebauthnError::AttestationStatementAlgInvalid
            | WebauthnError::AttestationTrustFailure
            | WebauthnError::AttestationCertificateAAGUIDMismatch
            | WebauthnError::AttestationCertificateNonceMismatch
            | WebauthnError::AttestationTpmStInvalid
            | WebauthnError::AttestationTpmPubAreaMismatch
            | WebauthnError::AttestationTpmExtraDataInvalid
            | WebauthnError::AttestationTpmExtraDataMismatch
            | WebauthnError::AttestationTpmPubAreaHashUnknown
            | WebauthnError::AttestationTpmPubAreaHashInvalid
            | WebauthnError::AttestationTpmAttestCertifyInvalid
            | WebauthnError::AttestationCertificateRequirementsNotMet
            | WebauthnError::AttestationCertificateTrustStoreEmpty
            | WebauthnError::AttestationLeafCertMissing
            | WebauthnError::AttestationNotVerifiable
            | WebauthnError::AttestationUntrustedAaguid
            | WebauthnError::AttestationFormatMissingAaguid
            | WebauthnError::AttestationChainNotTrusted(_)
            | WebauthnError::CertificatePublicKeyInvalid
            | WebauthnError::CredentialMayNotBeHardwareBound
            | WebauthnError::CredentialInsecureCryptography
            | WebauthnError::CredentialNotFound
            | WebauthnError::CredentialAlteredAlgFromRequest
            | WebauthnError::CredentialExcludedFromRequest
            | WebauthnError::CredentialPossibleCompromise
            | WebauthnError::CredentialBackupEligibilityInconsistent
            | WebauthnError::TrustFailure
            | WebauthnError::AuthenticationFailure
            | WebauthnError::InconsistentUserVerificationPolicy
            | WebauthnError::AttestationCredentialSubjectKeyMismatch
            | WebauthnError::CredentialCrossOrigin => Self::InvalidCredentials,
            WebauthnError::InvalidClientDataType
            | WebauthnError::MissingAttestationCredentialData
            | WebauthnError::ParseBase64Failure(_)
            | WebauthnError::ParseCBORFailure(_)
            | WebauthnError::ParseJSONFailure(_)
            | WebauthnError::ParseNOMFailure
            | WebauthnError::ParseInsufficientBytesAvailable
            | WebauthnError::COSEKeyInvalidCBORValue
            | WebauthnError::COSEKeyInvalidType
            | WebauthnError::COSEKeyEDUnsupported
            | WebauthnError::COSEKeyECDSAXYInvalid
            | WebauthnError::COSEKeyRSANEInvalid
            | WebauthnError::COSEKeyECDSAInvalidCurve
            | WebauthnError::COSEKeyEDDSAXInvalid
            | WebauthnError::COSEKeyEDDSAInvalidCurve
            | WebauthnError::COSEKeyInvalidAlgorithm
            | WebauthnError::InvalidUsername
            | WebauthnError::InvalidUserUniqueId
            | WebauthnError::ECDSACurveInvalidNid
            | WebauthnError::SshPublicKeyBackupState
            | WebauthnError::SshPublicKeyEDUnsupported
            | WebauthnError::SshPublicKeyInvalidCurve
            | WebauthnError::SshPublicKeyInvalidPubkey
            | WebauthnError::SshPublicKeyInconsistentUserVerification => Self::MalformedMessage,
            WebauthnError::Configuration
            | WebauthnError::ChallengePersistenceError
            | WebauthnError::OpenSSLError(_)
            | WebauthnError::OpenSSLErrorNoCurveName
            | WebauthnError::CredentialExistCheckError
            | WebauthnError::CredentialAlreadyExists
            | WebauthnError::CredentialPersistenceError
            | WebauthnError::CredentialRetrievalError
            | WebauthnError::CredentialCounterUpdateFailure
            | WebauthnError::CredentialCompromiseReportFailure
            | WebauthnError::MissingAttestationCaList => Self::Internal,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use webauthn_rs_core::proto::{COSEEC2Key, COSEOKPKey, COSERSAKey};

    fn check(key: &COSEKey, expected: &[u8]) {
        assert_eq!(cose_bytes(key).unwrap(), expected);
    }

    fn bytes(n: usize) -> base64urlsafedata::HumanBinaryData {
        vec![9u8; n].into()
    }

    fn cased(head: &[u8], first: &[u8], mid: &[u8], second: &[u8]) -> Vec<u8> {
        let mut out = Vec::from(head);
        out.extend_from_slice(first);
        out.extend_from_slice(mid);
        out.extend_from_slice(second);
        out
    }

    fn coord(n: usize) -> Vec<u8> {
        vec![9u8; n]
    }

    #[test]
    fn cose_encodes_canonical_bytes() {
        check(
            &COSEKey {
                type_: COSEAlgorithm::ES256,
                key: COSEKeyType::EC_EC2(COSEEC2Key {
                    curve: ECDSACurve::SECP256R1,
                    x: bytes(32),
                    y: bytes(32),
                }),
            },
            &cased(
                &[0xa5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01, 0x21, 0x58, 0x20],
                &coord(32),
                &[0x22, 0x58, 0x20],
                &coord(32),
            ),
        );
        check(
            &COSEKey {
                type_: COSEAlgorithm::ES384,
                key: COSEKeyType::EC_EC2(COSEEC2Key {
                    curve: ECDSACurve::SECP384R1,
                    x: bytes(48),
                    y: bytes(48),
                }),
            },
            &cased(
                &[
                    0xa5, 0x01, 0x02, 0x03, 0x38, 0x22, 0x20, 0x02, 0x21, 0x58, 0x30,
                ],
                &coord(48),
                &[0x22, 0x58, 0x30],
                &coord(48),
            ),
        );
        check(
            &COSEKey {
                type_: COSEAlgorithm::ES512,
                key: COSEKeyType::EC_EC2(COSEEC2Key {
                    curve: ECDSACurve::SECP521R1,
                    x: bytes(66),
                    y: bytes(66),
                }),
            },
            &cased(
                &[
                    0xa5, 0x01, 0x02, 0x03, 0x38, 0x23, 0x20, 0x03, 0x21, 0x58, 0x42,
                ],
                &coord(66),
                &[0x22, 0x58, 0x42],
                &coord(66),
            ),
        );
        check(
            &COSEKey {
                type_: COSEAlgorithm::EDDSA,
                key: COSEKeyType::EC_OKP(COSEOKPKey {
                    curve: EDDSACurve::ED25519,
                    x: bytes(32),
                }),
            },
            &cased(
                &[0xa4, 0x01, 0x01, 0x03, 0x27, 0x20, 0x06, 0x21, 0x58, 0x20],
                &coord(32),
                &[],
                &[],
            ),
        );
        check(
            &COSEKey {
                type_: COSEAlgorithm::RS256,
                key: COSEKeyType::RSA(COSERSAKey {
                    n: bytes(8),
                    e: [1, 0, 1],
                }),
            },
            &cased(
                &[0xa4, 0x01, 0x03, 0x03, 0x39, 0x01, 0x00, 0x20, 0x48],
                &coord(8),
                &[0x21, 0x43],
                &[0x01, 0x00, 0x01],
            ),
        );
    }
}
