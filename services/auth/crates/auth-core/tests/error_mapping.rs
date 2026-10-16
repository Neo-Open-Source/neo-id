use auth_core::AuthError;
use opaque_ke::errors::{InternalError, ProtocolError};

fn cases() -> Vec<(ProtocolError, AuthError)> {
    use InternalError::*;
    use ProtocolError::*;
    vec![
        (InvalidLoginError, AuthError::InvalidCredentials),
        (
            LibraryError(SealOpenHmacError),
            AuthError::InvalidCredentials,
        ),
        (SerializationError, AuthError::MalformedMessage),
        (
            SizeError {
                name: "request",
                len: 32,
                actual_len: 31,
            },
            AuthError::MalformedMessage,
        ),
        (ReflectedValueError, AuthError::MalformedMessage),
        (
            LibraryError(IncompatibleEnvelopeModeError),
            AuthError::MalformedMessage,
        ),
        (
            LibraryError(OprfError(voprf::Error::Deserialization)),
            AuthError::MalformedMessage,
        ),
        (
            LibraryError(OprfError(voprf::Error::Input)),
            AuthError::MalformedMessage,
        ),
        (
            LibraryError(OprfError(voprf::Error::Batch)),
            AuthError::MalformedMessage,
        ),
        (
            LibraryError(OprfError(voprf::Error::Info)),
            AuthError::Internal,
        ),
        (
            LibraryError(OprfError(voprf::Error::DeriveKeyPair)),
            AuthError::Internal,
        ),
        (
            LibraryError(OprfError(voprf::Error::ProofVerification)),
            AuthError::Internal,
        ),
        (
            LibraryError(OprfError(voprf::Error::Protocol)),
            AuthError::Internal,
        ),
        (LibraryError(HashToScalar), AuthError::Internal),
        (LibraryError(HkdfError), AuthError::Internal),
        (LibraryError(HmacError), AuthError::Internal),
        (LibraryError(KsfError), AuthError::Internal),
        (
            LibraryError(OprfInternalError(voprf::InternalError::Input)),
            AuthError::Internal,
        ),
        (
            LibraryError(OprfInternalError(voprf::InternalError::I2osp)),
            AuthError::Internal,
        ),
    ]
}

#[test]
fn library_errors_map_to_coarse_errors() {
    for (input, expected) in cases() {
        assert_eq!(AuthError::from(input), expected);
    }
}
