#![allow(dead_code, reason = "shared fixtures: each test binary uses a subset")]

use auth_core::AuthError;
use auth_db::{Executor, Kv, Query};
use std::collections::HashMap;
use std::collections::VecDeque;

pub struct Scripted {
    pub rows: std::sync::Mutex<VecDeque<Vec<serde_json::Value>>>,
    pub calls: std::sync::Mutex<Vec<(String, Vec<serde_json::Value>)>>,
}

impl Scripted {
    pub fn feed(values: Vec<Vec<serde_json::Value>>) -> Self {
        Self {
            rows: std::sync::Mutex::new(values.into()),
            calls: std::sync::Mutex::new(Vec::new()),
        }
    }

    pub fn ran(&self, needle: &str) -> bool {
        self.calls
            .lock()
            .unwrap()
            .iter()
            .any(|(sql, _)| sql.contains(needle))
    }

    pub fn param(&self, sql_needle: &str, index: usize) -> Option<serde_json::Value> {
        self.calls
            .lock()
            .unwrap()
            .iter()
            .find(|(sql, _)| sql.contains(sql_needle))
            .and_then(|(_, params)| params.get(index).cloned())
    }
}

impl Executor for Scripted {
    fn run(&self, query: Query) -> impl Future<Output = Result<Vec<serde_json::Value>, AuthError>> {
        self.calls
            .lock()
            .unwrap()
            .push((query.sql.to_string(), query.params.clone()));
        let rows = self.rows.lock().unwrap().pop_front().unwrap_or_default();
        async move { Ok(rows) }
    }
}

pub fn run<F: Future<Output = T>, T>(future: F) -> T {
    futures::executor::block_on(future)
}

#[derive(Default)]
pub struct MemKv {
    store: std::sync::Mutex<HashMap<String, Vec<u8>>>,
}

impl MemKv {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn len(&self) -> usize {
        self.store.lock().unwrap().len()
    }
}

impl Kv for MemKv {
    fn get(&self, key: &str) -> impl Future<Output = Result<Option<Vec<u8>>, AuthError>> {
        let value = self.store.lock().unwrap().get(key).cloned();
        async move { Ok(value) }
    }

    fn put(
        &self,
        key: &str,
        value: &[u8],
        _ttl_secs: u64,
    ) -> impl Future<Output = Result<(), AuthError>> {
        self.store
            .lock()
            .unwrap()
            .insert(key.to_string(), value.to_vec());
        async move { Ok(()) }
    }

    fn delete(&self, key: &str) -> impl Future<Output = Result<(), AuthError>> {
        self.store.lock().unwrap().remove(key);
        async move { Ok(()) }
    }
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
