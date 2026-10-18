use auth_core::AuthError;
use auth_db::{Executor, Query};
use auth_oidc::{ClientRegistrationRequest, register};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::sync::Mutex;

struct Capture {
    queries: Mutex<Vec<Query>>,
}

impl Capture {
    fn new() -> Self {
        Self {
            queries: Mutex::new(Vec::new()),
        }
    }

    fn insert_params(&self) -> Vec<serde_json::Value> {
        let queries = self.queries.lock().unwrap();
        queries
            .iter()
            .find(|query| query.sql.contains(r#"INSERT INTO "service_apps""#))
            .map(|query| query.params.clone())
            .unwrap_or_default()
    }
}

impl Executor for Capture {
    fn run(
        &self,
        query: Query,
    ) -> impl std::future::Future<Output = Result<Vec<serde_json::Value>, AuthError>> {
        self.queries.lock().unwrap().push(query);
        async { Ok(Vec::new()) }
    }
}

fn request(name: Option<&str>) -> ClientRegistrationRequest {
    ClientRegistrationRequest {
        owner_id: "owner-1".to_string(),
        redirect_uris: vec!["https://app.example/cb".to_string()],
        client_name: name.map(str::to_string),
    }
}

#[tokio::test]
async fn register_persists_owner_name_and_redirects() {
    let db = Capture::new();
    register(
        &db,
        &mut ChaCha8Rng::seed_from_u64(1),
        1000,
        request(Some("Example")),
    )
    .await
    .unwrap();
    let params = db.insert_params();
    assert_eq!(params[0], serde_json::json!("owner-1"));
    assert_eq!(params[3], serde_json::json!("Example"));
    assert_eq!(params[4], serde_json::json!(["https://app.example/cb"]));
}

#[tokio::test]
async fn register_defaults_blank_name() {
    let db = Capture::new();
    register(
        &db,
        &mut ChaCha8Rng::seed_from_u64(1),
        1000,
        request(Some("   ")),
    )
    .await
    .unwrap();
    assert_eq!(db.insert_params()[3], serde_json::json!("Dynamic client"));
}
