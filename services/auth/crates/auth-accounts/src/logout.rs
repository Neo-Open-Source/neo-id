use auth_core::AuthError;
use auth_db::{
    Executor, deactivate_session, deactivate_user_sessions, revoke_session_refreshes,
    revoke_user_refreshes,
};

pub async fn end_session<E: Executor>(db: &E, session_id: &str, now: u64) -> Result<(), AuthError> {
    db.run(deactivate_session(session_id)).await?;
    db.run(revoke_session_refreshes(session_id, "logout", now))
        .await?;
    Ok(())
}

pub async fn end_all_sessions<E: Executor>(
    db: &E,
    user_id: &str,
    now: u64,
) -> Result<(), AuthError> {
    db.run(deactivate_user_sessions(user_id)).await?;
    db.run(revoke_user_refreshes(user_id, "all_sessions_revoked", now))
        .await?;
    Ok(())
}
