use auth_db::{Executor, deactivate_session, deactivate_user_sessions};

use crate::authorize::WireError;

#[derive(Debug, Clone)]
pub struct LogoutRequest {
    pub session_id: Option<String>,
    pub user_id: Option<String>,
    pub post_logout_redirect: Option<String>,
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
    Ok(Logout {
        redirect_url: req
            .post_logout_redirect
            .filter(|url| !url.trim().is_empty())
            .unwrap_or_else(|| "/".to_string()),
    })
}
