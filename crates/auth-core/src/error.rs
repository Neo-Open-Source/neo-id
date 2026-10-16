use opaque_ke::errors::{InternalError, ProtocolError};
use thiserror::Error;

#[derive(Debug, Error, PartialEq, Eq)]
pub enum AuthError {
    #[error("malformed protocol message")]
    MalformedMessage,
    /// Single variant so callers cannot learn which failure it was.
    #[error("invalid credentials")]
    InvalidCredentials,
    #[error("internal authentication failure")]
    Internal,
}

impl From<ProtocolError> for AuthError {
    fn from(err: ProtocolError) -> Self {
        match err {
            ProtocolError::InvalidLoginError => Self::InvalidCredentials,
            ProtocolError::LibraryError(InternalError::SealOpenHmacError) => {
                Self::InvalidCredentials
            }
            ProtocolError::SerializationError
            | ProtocolError::SizeError { .. }
            | ProtocolError::ReflectedValueError
            | ProtocolError::LibraryError(
                InternalError::IncompatibleEnvelopeModeError
                | InternalError::OprfError(
                    voprf::Error::Deserialization | voprf::Error::Input | voprf::Error::Batch,
                ),
            ) => Self::MalformedMessage,
            ProtocolError::LibraryError(
                InternalError::HashToScalar
                | InternalError::HkdfError
                | InternalError::HmacError
                | InternalError::KsfError
                | InternalError::OprfError(
                    voprf::Error::Info
                    | voprf::Error::DeriveKeyPair
                    | voprf::Error::ProofVerification
                    | voprf::Error::Protocol,
                )
                | InternalError::OprfInternalError(_),
            )
            | ProtocolError::Custom(_) => Self::Internal,
        }
    }
}

pub(crate) fn reject_trailing(parsed_len: usize, bytes: &[u8]) -> Result<(), AuthError> {
    if parsed_len == bytes.len() {
        Ok(())
    } else {
        Err(AuthError::MalformedMessage)
    }
}
