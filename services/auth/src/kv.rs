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

impl db::Kv for StatesKv {
    async fn get(&self, key: &str) -> Result<Option<Vec<u8>>, AuthError> {
        self.store
            .get(key)
            .text()
            .await
            .map(|value| value.map(String::into_bytes))
            .map_err(|_| AuthError::Internal)
    }

    async fn put(&self, key: &str, value: &[u8], ttl_secs: u64) -> Result<(), AuthError> {
        let text = std::str::from_utf8(value).map_err(|_| AuthError::Internal)?;
        self.store
            .put(key, text.to_string())
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
