use auth_db::{Executor, deactivate_session, deactivate_user_sessions};

use crate::authorize::WireError;

#[derive(Debug, Clone)]
pub struct LogoutRequest {
    pub session_id: Option<String>,
    pub user_id: Option<String>,
    pub post_logout_redirect: Option<String>,
    pub state: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Logout {
    pub redirect_url: String,
}

pub async fn logout<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    req: LogoutRequest,
) -> Result<Logout, WireError> {
    let _ = (rng as &mut R, now);
    match (req.session_id, req.user_id) {
        (Some(session_id), _) => {
            db.run(deactivate_session(&session_id)).await?;
        }
        (None, Some(user_id)) => {
            db.run(deactivate_user_sessions(&user_id)).await?;
        }
        (None, None) => {}
    }
    let target = req
        .post_logout_redirect
        .filter(|url| !url.trim().is_empty())
        .unwrap_or_else(|| "/".to_string());
    let redirect_url = match req.state.filter(|state| !state.is_empty()) {
        Some(state) => {
            let separator = if target.contains('?') { '&' } else { '?' };
            format!("{target}{separator}state={}", encode_state(&state))
        }
        None => target,
    };
    Ok(Logout { redirect_url })
}

fn encode_state(state: &str) -> String {
    use std::fmt::Write as _;
    let mut out = String::with_capacity(state.len());
    for byte in state.bytes() {
        match byte {
            b'0'..=b'9' | b'A'..=b'Z' | b'a'..=b'z' | b'-' | b'_' | b'.' | b'~' => {
                out.push(byte as char);
            }
            _ => {
                let _ = write!(out, "%{byte:02X}");
            }
        }
    }
    out
}
