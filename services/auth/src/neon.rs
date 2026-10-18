use auth_core::AuthError;
use db::{Executor, Query, query_body, rows};
use worker::{Fetch, Headers, Method, Request, RequestInit};

pub struct NeonExecutor {
    endpoint: String,
    connection_string: String,
}

impl NeonExecutor {
    pub fn new(endpoint: String, connection_string: String) -> Self {
        Self {
            endpoint,
            connection_string,
        }
    }
}

impl Executor for NeonExecutor {
    async fn run(&self, query: Query) -> Result<Vec<serde_json::Value>, AuthError> {
        let headers = Headers::new();
        headers
            .set("content-type", "application/json")
            .map_err(|_| AuthError::Internal)?;
        headers
            .set("neon-connection-string", &self.connection_string)
            .map_err(|_| AuthError::Internal)?;
        let request = Request::new_with_init(
            &self.endpoint,
            &RequestInit {
                method: Method::Post,
                headers,
                body: Some(query_body(query.sql, &query.params).into()),
                ..Default::default()
            },
        )
        .map_err(|_| AuthError::Internal)?;
        let mut response = Fetch::Request(request)
            .send()
            .await
            .map_err(|_| AuthError::Internal)?;
        if response.status_code() != 200 {
            return Err(AuthError::Internal);
        }
        let text = response.text().await.map_err(|_| AuthError::Internal)?;
        rows(&text)
    }
}
