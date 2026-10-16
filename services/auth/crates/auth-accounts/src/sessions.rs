use auth_core::AuthError;
use auth_db::{
    Executor, deactivate_session, deactivate_user_sessions, find_session, revoke_session_refreshes,
    revoke_user_refreshes, sessions_by_user,
};

pub async fn list_sessions<E: Executor>(
    db: &E,
    user_id: &str,
) -> Result<Vec<serde_json::Value>, AuthError> {
    db.run(sessions_by_user(user_id)).await
}

pub async fn revoke_session<E: Executor>(
    db: &E,
    session_id: &str,
    user_id: &str,
    now: u64,
) -> Result<bool, AuthError> {
    let rows = db.run(find_session(session_id)).await?;
    let owned = rows
        .first()
        .and_then(|row| row.get("userId"))
        .and_then(serde_json::Value::as_str)
        == Some(user_id);
    if !owned {
        return Ok(false);
    }
    db.run(deactivate_session(session_id)).await?;
    db.run(revoke_session_refreshes(session_id, "session_revoked", now))
        .await?;
    Ok(true)
}

pub async fn revoke_all_sessions<E: Executor>(
    db: &E,
    user_id: &str,
    now: u64,
) -> Result<(), AuthError> {
    db.run(deactivate_user_sessions(user_id)).await?;
    db.run(revoke_user_refreshes(user_id, "all_sessions_revoked", now))
        .await?;
    Ok(())
}
