use auth_core::{generate_token, hash_token};
use auth_db::Executor;

use crate::authorize::WireError;

#[derive(Debug, Clone)]
pub struct RegisterRequest {
    pub redirect_uris: Vec<String>,
    pub client_name: Option<String>,
}

#[derive(Clone, PartialEq, Eq)]
pub struct ClientRegistered {
    pub client_id: String,
    pub client_secret: String,
    pub client_secret_hash: String,
    pub redirect_uris: Vec<String>,
}

impl core::fmt::Debug for ClientRegistered {
    fn fmt(&self, formatter: &mut core::fmt::Formatter<'_>) -> core::fmt::Result {
        formatter
            .debug_struct("ClientRegistered")
            .field("client_id", &self.client_id)
            .field("redirect_uris", &self.redirect_uris)
            .finish_non_exhaustive()
    }
}

pub async fn register<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    req: RegisterRequest,
) -> Result<ClientRegistered, WireError> {
    let _ = (db, now);
    let RegisterRequest {
        redirect_uris,
        client_name,
    } = req;
    let _ = client_name;
    let redirect_uris: Vec<String> = redirect_uris
        .iter()
        .map(|uri| uri.trim().to_string())
        .filter(|uri| !uri.is_empty())
        .collect();
    if redirect_uris.is_empty() || redirect_uris.iter().any(|uri| !valid_redirect_uri(uri)) {
        return Err(WireError::InvalidRequest);
    }
    let client_secret = generate_token(rng, 40);
    Ok(ClientRegistered {
        client_id: generate_token(rng, 20),
        client_secret_hash: hash_token(&client_secret),
        client_secret,
        redirect_uris,
    })
}

fn valid_redirect_uri(uri: &str) -> bool {
    uri.contains("://") && !uri.chars().any(char::is_whitespace)
}
