use auth_core::AuthError;
use base64::{Engine, engine::general_purpose::STANDARD};
use worker::kv::KvStore;

pub struct StatesKv {
    store: KvStore,
}

impl StatesKv {
    pub fn new(store: KvStore) -> Self {
        Self { store }
    }
}

impl db::Kv for StatesKv {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, AuthError> {
        let value = self
            .store
            .get(key)
            .text()
            .await
            .map_err(|_| AuthError::Internal)?;
        match value {
            Some(text) => STANDARD
                .decode(text)
                .map(Some)
                .map_err(|_| AuthError::Internal),
            None => Ok(None),
        }
    }

    async fn put(&self, key: &str, value: &[u8], ttl_secs: u64) -> Result<(), AuthError> {
        self.store
            .put(key, STANDARD.encode(value))
            .map_err(|_| AuthError::Internal)?
            .expiration_ttl(ttl_secs)
            .execute()
            .await
            .map_err(|_| AuthError::Internal)
    }

    async fn delete(&self, key: &str) -> Result<(), AuthError> {
        self.store
            .delete(key)
            .await
            .map_err(|_| AuthError::Internal)
    }
}
