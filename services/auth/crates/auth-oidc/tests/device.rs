use auth_core::AuthError;
use auth_db::Kv;
use auth_oidc::{
    ApproveOutcome, AuthorizationCode, DeviceStatus, approve, poll, start_device,
    store_authcode_state, take_authcode_state,
};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::collections::HashMap;
use std::sync::Mutex;

#[derive(Default)]
struct MemKv {
    store: Mutex<HashMap<String, Vec<u8>>>,
}

impl MemKv {
    fn keys(&self) -> Vec<String> {
        let mut keys: Vec<String> = self.store.lock().unwrap().keys().cloned().collect();
        keys.sort();
        keys
    }
}

impl Kv for MemKv {
    fn get(
        &self,
        key: &str,
    ) -> impl std::future::Future<Output = Result<Option<Vec<u8>>, AuthError>> {
        let value = self.store.lock().unwrap().get(key).cloned();
        async move { Ok(value) }
    }

    fn put(
        &self,
        key: &str,
        value: &[u8],
        _ttl_secs: u64,
    ) -> impl std::future::Future<Output = Result<(), AuthError>> {
        self.store
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_vec());
        async move { Ok(()) }
    }

    fn delete(&self, key: &str) -> impl std::future::Future<Output = Result<(), AuthError>> {
        self.store.lock().unwrap().remove(key);
        async move { Ok(()) }
    }
}

const NOW: u64 = 1_800_000_000;

#[tokio::test]
async fn device_flow_pending_then_approved() {
    let kv = MemKv::default();
    let mut rng = ChaCha8Rng::seed_from_u64(1);
    let start = start_device(&kv, &mut rng, NOW, "Smart TV", "10.0.0.1", "TV/1.0", "")
        .await
        .unwrap();
    assert_eq!(start.state.status, "pending");
    assert!(start.state.user_code.contains('-'));

    assert!(matches!(
        poll(&kv, &start.device_code, NOW + 1).await.unwrap(),
        DeviceStatus::Pending
    ));

    assert_eq!(
        approve(&kv, &start.state.user_code, "u1", NOW + 2)
            .await
            .unwrap(),
        ApproveOutcome::Approved
    );
    match poll(&kv, &start.device_code, NOW + 3).await.unwrap() {
        DeviceStatus::Approved { user_id } => assert_eq!(user_id, "u1"),
        _ => panic!("expected approved"),
    }
    // consumed
    assert!(matches!(
        poll(&kv, &start.device_code, NOW + 4).await.unwrap(),
        DeviceStatus::Expired
    ));
}

#[tokio::test]
async fn device_flow_binds_expected_user() {
    let kv = MemKv::default();
    let mut rng = ChaCha8Rng::seed_from_u64(5);
    let start = start_device(&kv, &mut rng, NOW, "", "", "", "u1")
        .await
        .unwrap();
    assert_eq!(
        approve(&kv, &start.state.user_code, "u2", NOW + 1)
            .await
            .unwrap(),
        ApproveOutcome::Mismatch
    );
    assert_eq!(
        approve(&kv, &start.state.user_code, "u1", NOW + 2)
            .await
            .unwrap(),
        ApproveOutcome::Approved
    );
}

#[tokio::test]
async fn device_flow_rejects_unknown_and_expired() {
    let kv = MemKv::default();
    let mut rng = ChaCha8Rng::seed_from_u64(2);
    assert_eq!(
        approve(&kv, "ZZZZ-ZZZZ", "u1", NOW).await.unwrap(),
        ApproveOutcome::Unknown
    );

    let start = start_device(&kv, &mut rng, NOW, "", "", "", "")
        .await
        .unwrap();
    assert!(matches!(
        poll(&kv, &start.device_code, NOW + 10_000).await.unwrap(),
        DeviceStatus::Expired
    ));
    assert_eq!(
        approve(&kv, &start.state.user_code, "u1", NOW + 10_000)
            .await
            .unwrap(),
        ApproveOutcome::Unknown
    );
}

#[tokio::test]
async fn device_keys_and_user_code_shape() {
    let kv = MemKv::default();
    let mut rng = ChaCha8Rng::seed_from_u64(7);
    let start = start_device(&kv, &mut rng, NOW, "", "", "", "")
        .await
        .unwrap();
    let keys = kv.keys();
    assert!(keys.contains(&format!("device:{}", start.device_code)));
    assert!(keys.contains(&format!("devuc:{}", start.state.user_code.to_uppercase())));

    let code = &start.state.user_code;
    assert_eq!(code.len(), 9);
    assert_eq!(code.chars().filter(|c| *c == '-').count(), 1);
    assert_eq!(code.chars().nth(4), Some('-'));
    assert!(
        code.chars()
            .filter(|c| *c != '-')
            .all(|c| c.is_ascii_uppercase() || c.is_ascii_digit())
    );
}

#[tokio::test]
async fn device_expiry_boundary() {
    let kv = MemKv::default();
    let mut rng = ChaCha8Rng::seed_from_u64(8);
    let start = start_device(&kv, &mut rng, NOW, "", "", "", "")
        .await
        .unwrap();
    assert!(matches!(
        poll(&kv, &start.device_code, NOW + 300).await.unwrap(),
        DeviceStatus::Pending
    ));
    assert!(matches!(
        poll(&kv, &start.device_code, NOW + 301).await.unwrap(),
        DeviceStatus::Expired
    ));
}

#[tokio::test]
async fn authcode_state_roundtrip_and_consume() {
    let kv = MemKv::default();
    let state = AuthorizationCode {
        nonce: Some("n".to_string()),
        scopes: vec!["openid".to_string()],
    };
    store_authcode_state(&kv, "acn:c1", &state).await.unwrap();
    let loaded = take_authcode_state(&kv, "acn:c1").await.unwrap().unwrap();
    assert_eq!(loaded.nonce.as_deref(), Some("n"));
    assert_eq!(loaded.scopes, vec!["openid".to_string()]);
    assert!(take_authcode_state(&kv, "acn:c1").await.unwrap().is_none());
    assert_eq!(kv.keys(), Vec::<String>::new());
}
