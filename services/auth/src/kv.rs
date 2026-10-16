use auth_core::AuthError;
use worker::kv::KvStore;

pub struct StatesKv {
    store: KvStore,
}

impl StatesKv {
    pub fn new(store: KvStore) -> Self {
        Self { store }
    }
}

impl auth_db::Kv for StatesKv {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, AuthError> {
        self.store
            .get(key)
            .bytes()
            .await
            .map_err(|_| AuthError::Internal)
    }

    async fn put(&self, key: &str, value: &[u8], ttl_secs: u64) -> Result<(), AuthError> {
        self.store
            .put(key, value.to_vec())
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
