use opaque_ke::{
    ClientLogin, ClientLoginFinishParameters, ClientRegistration,
    ClientRegistrationFinishParameters, CredentialResponse, RegistrationResponse,
};
use rand::{CryptoRng, RngCore};

use crate::{NeoSuite, error::AuthError, error::reject_trailing};

pub fn register_request<R: RngCore + CryptoRng>(
    rng: &mut R,
    password: &[u8],
) -> Result<(Vec<u8>, ClientRegistration<NeoSuite>), AuthError> {
    let start = ClientRegistration::<NeoSuite>::start(rng, password)?;
    Ok((start.message.serialize().to_vec(), start.state))
}

pub fn register_upload<R: RngCore + CryptoRng>(
    state: ClientRegistration<NeoSuite>,
    rng: &mut R,
    password: &[u8],
    response_bytes: &[u8],
) -> Result<Vec<u8>, AuthError> {
    let response = RegistrationResponse::deserialize(response_bytes).map_err(AuthError::from)?;
    reject_trailing(response.serialize().len(), response_bytes)?;
    let finish = state.finish(
        rng,
        password,
        response,
        ClientRegistrationFinishParameters::default(),
    )?;
    Ok(finish.message.serialize().to_vec())
}

pub fn login_request<R: RngCore + CryptoRng>(
    rng: &mut R,
    password: &[u8],
) -> Result<(Vec<u8>, ClientLogin<NeoSuite>), AuthError> {
    let start = ClientLogin::<NeoSuite>::start(rng, password)?;
    Ok((start.message.serialize().to_vec(), start.state))
}

pub fn login_finalize<R: RngCore + CryptoRng>(
    state: ClientLogin<NeoSuite>,
    rng: &mut R,
    password: &[u8],
    response_bytes: &[u8],
) -> Result<(Vec<u8>, Vec<u8>), AuthError> {
    let response = CredentialResponse::deserialize(response_bytes).map_err(AuthError::from)?;
    reject_trailing(response.serialize().len(), response_bytes)?;
    let finish = state.finish(
        rng,
        password,
        response,
        ClientLoginFinishParameters::default(),
    )?;
    Ok((
        finish.message.serialize().to_vec(),
        finish.session_key.as_slice().to_vec(),
    ))
}
