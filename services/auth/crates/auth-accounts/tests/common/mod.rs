#![allow(dead_code, reason = "shared fixtures: each test binary uses a subset")]

use auth_core::AuthError;
use auth_db::{Executor, Query};
use std::collections::VecDeque;

pub struct Scripted {
    pub rows: std::sync::Mutex<VecDeque<Vec<serde_json::Value>>>,
}

impl Scripted {
    pub fn feed(values: Vec<Vec<serde_json::Value>>) -> Self {
        Self {
            rows: std::sync::Mutex::new(values.into()),
        }
    }
}

impl Executor for Scripted {
    fn run(
        &self,
        _query: Query,
    ) -> impl Future<Output = Result<Vec<serde_json::Value>, AuthError>> {
        let rows = self.rows.lock().unwrap().pop_front().unwrap_or_default();
        async move { Ok(rows) }
    }
}

pub fn run<F: Future<Output = T>, T>(future: F) -> T {
    futures::executor::block_on(future)
}

pub fn user_row() -> serde_json::Value {
    serde_json::json!({"id": "u1", "email": "a@b.c", "role": "user"})
}

pub fn refresh_row() -> serde_json::Value {
    serde_json::json!({
        "id": "r1", "userId": "u1", "sessionId": "s1",
        "expiresAt": 2000, "revokedAt": null, "revokeReason": null,
        "status": "active",
    })
}

pub fn session_row() -> serde_json::Value {
    serde_json::json!({"id": "s1", "userId": "u1", "isActive": true})
}
