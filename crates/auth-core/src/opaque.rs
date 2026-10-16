use opaque_ke::{
    CredentialFinalization, CredentialRequest, RegistrationRequest, RegistrationUpload,
    ServerLogin, ServerLoginParameters, ServerRegistration,
};
use rand::{CryptoRng, RngCore};
use zeroize::Zeroizing;

use crate::{NeoSuite, OpaqueSetup, error::AuthError, error::reject_trailing};

#[derive(Debug, Clone, Copy)]
pub struct CredentialId<'a>(&'a [u8]);

impl<'a> TryFrom<&'a [u8]> for CredentialId<'a> {
    type Error = AuthError;

    fn try_from(bytes: &'a [u8]) -> Result<Self, AuthError> {
        if bytes.is_empty() {
            Err(AuthError::MalformedMessage)
        } else {
            Ok(Self(bytes))
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Envelope(Vec<u8>);

impl Envelope {
    pub fn try_from_bytes(bytes: &[u8]) -> Result<Self, AuthError> {
        let file = ServerRegistration::<NeoSuite>::deserialize(bytes).map_err(AuthError::from)?;
        reject_trailing(file.serialize().len(), bytes)?;
        Ok(Self(bytes.to_vec()))
    }

    #[must_use]
    pub fn as_bytes(&self) -> &[u8] {
        &self.0
    }
}

#[derive(Debug, Clone)]
pub struct LoginState(Vec<u8>);

impl LoginState {
    fn new(bytes: Vec<u8>) -> Self {
        Self(bytes)
    }

    #[must_use]
    pub fn into_bytes(self) -> Vec<u8> {
        let LoginState(bytes) = self;
        bytes
    }

    pub fn from_bytes(bytes: Vec<u8>) -> Result<Self, AuthError> {
        let state =
            ServerLogin::<NeoSuite>::deserialize(bytes.as_slice()).map_err(AuthError::from)?;
        if state.serialize().len() == bytes.len() {
            Ok(Self(bytes))
        } else {
            Err(AuthError::MalformedMessage)
        }
    }
}

pub struct SessionKey(Zeroizing<Vec<u8>>);

impl SessionKey {
    #[must_use]
    pub fn expose(&self) -> Vec<u8> {
        self.0.to_vec()
    }
}

impl std::fmt::Debug for SessionKey {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("SessionKey(REDACTED)")
    }
}
pub fn register_response(
    setup: &OpaqueSetup,
    request_bytes: &[u8],
    id: CredentialId<'_>,
) -> Result<Vec<u8>, AuthError> {
    let request = RegistrationRequest::deserialize(request_bytes).map_err(AuthError::from)?;
    reject_trailing(request.serialize().len(), request_bytes)?;
    let result = ServerRegistration::start(setup.inner(), request, id.0)?;
    Ok(result.message.serialize().to_vec())
}

pub fn register_store(upload_bytes: &[u8]) -> Result<Envelope, AuthError> {
    let upload =
        RegistrationUpload::<NeoSuite>::deserialize(upload_bytes).map_err(AuthError::from)?;
    reject_trailing(upload.serialize().len(), upload_bytes)?;
    let file = ServerRegistration::finish(upload);
    Ok(Envelope(file.serialize().to_vec()))
}

pub fn login_response<R: RngCore + CryptoRng>(
    setup: &OpaqueSetup,
    envelope: &Envelope,
    request_bytes: &[u8],
    id: CredentialId<'_>,
    rng: &mut R,
) -> Result<(Vec<u8>, LoginState), AuthError> {
    let file = ServerRegistration::<NeoSuite>::deserialize(envelope.as_bytes())?;
    let request = CredentialRequest::deserialize(request_bytes).map_err(AuthError::from)?;
    reject_trailing(request.serialize().len(), request_bytes)?;
    let result = ServerLogin::start(
        rng,
        setup.inner(),
        Some(file),
        request,
        id.0,
        ServerLoginParameters::default(),
    )?;
    Ok((
        result.message.serialize().to_vec(),
        LoginState::new(result.state.serialize().to_vec()),
    ))
}

pub fn login_finish(state: LoginState, finalization_bytes: &[u8]) -> Result<SessionKey, AuthError> {
    let message =
        CredentialFinalization::deserialize(finalization_bytes).map_err(AuthError::from)?;
    reject_trailing(message.serialize().len(), finalization_bytes)?;
    let LoginState(bytes) = state;
    let login = ServerLogin::<NeoSuite>::deserialize(&bytes).map_err(AuthError::from)?;
    let result = login.finish(message, ServerLoginParameters::default())?;
    Ok(SessionKey(Zeroizing::new(result.session_key.to_vec())))
}
