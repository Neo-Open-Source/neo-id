use opaque_ke::ServerSetup;
use rand::{CryptoRng, RngCore};

use crate::{NeoSuite, error::AuthError, error::reject_trailing};

#[derive(Debug)]
pub struct OpaqueSetup(ServerSetup<NeoSuite>);

impl OpaqueSetup {
    pub fn generate<R: RngCore + CryptoRng>(rng: &mut R) -> Self {
        Self(ServerSetup::new(rng))
    }

    #[must_use]
    pub fn to_bytes(&self) -> Vec<u8> {
        self.0.serialize().to_vec()
    }

    pub fn try_from_bytes(bytes: &[u8]) -> Result<Self, AuthError> {
        let setup = ServerSetup::deserialize(bytes).map_err(AuthError::from)?;
        reject_trailing(setup.serialize().len(), bytes)?;
        Ok(Self(setup))
    }

    pub(crate) fn inner(&self) -> &ServerSetup<NeoSuite> {
        &self.0
    }
}
