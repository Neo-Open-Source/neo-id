use auth_core::{generate_token, hash_token};
use auth_db::{Executor, create_client};
use auth_proto::auth::v1::ClientRegistrationRequest;

use crate::authorize::WireError;

#[derive(Clone, PartialEq, Eq)]
pub struct ClientRegistered {
    pub client_id: String,
    pub client_secret: String,
    pub client_secret_hash: String,
    pub redirect_uris: Vec<String>,
    pub created_at: u64,
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
    req: ClientRegistrationRequest,
) -> Result<ClientRegistered, WireError> {
    let redirect_uris: Vec<String> = req
        .redirect_uris
        .iter()
        .map(|uri| uri.trim().to_string())
        .filter(|uri| !uri.is_empty())
        .collect();
    if req.owner_id.is_empty()
        || redirect_uris.is_empty()
        || redirect_uris.iter().any(|uri| !valid_redirect_uri(uri))
    {
        return Err(WireError::InvalidRequest);
    }
    let scope = vec![
        "openid".to_string(),
        "profile".to_string(),
        "email".to_string(),
    ];
    let grants = vec![
        "authorization_code".to_string(),
        "refresh_token".to_string(),
    ];
    let client_id = generate_token(rng, 20);
    let client_secret = generate_token(rng, 40);
    let client_secret_hash = hash_token(&client_secret);
    let name = req
        .client_name
        .filter(|name| !name.trim().is_empty())
        .unwrap_or_else(|| "Dynamic client".to_string());
    db.run(create_client(
        &req.owner_id,
        &client_id,
        Some(&client_secret_hash),
        &name,
        &redirect_uris,
        &scope,
        &grants,
        now,
    ))
    .await?;
    Ok(ClientRegistered {
        client_id,
        client_secret,
        client_secret_hash,
        redirect_uris,
        created_at: now,
    })
}

fn valid_redirect_uri(uri: &str) -> bool {
    uri.contains("://") && !uri.chars().any(char::is_whitespace)
}
