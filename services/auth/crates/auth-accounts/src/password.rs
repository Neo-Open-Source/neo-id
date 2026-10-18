use auth_core::{AuthError, RESET_TOKEN_EXPIRY, generate_token, hash_token};
use auth_db::{
    Executor, clear_reset_token, deactivate_user_sessions, find_by_reset_hash, find_user_by_email,
    revoke_user_refreshes, set_reset_token,
};

pub enum ForgotOutcome {
    Emailed(String),
    Unknown,
}

pub async fn forgot_password<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    email: &str,
    now: u64,
) -> Result<ForgotOutcome, AuthError> {
    let users = db.run(find_user_by_email(email)).await?;
    let Some(user) = users.first() else {
        return Ok(ForgotOutcome::Unknown);
    };
    let id = user
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?;
    let ticket = generate_token(rng, 32);
    db.run(set_reset_token(
        id,
        &hash_token(&ticket),
        now + RESET_TOKEN_EXPIRY,
    ))
    .await?;
    Ok(ForgotOutcome::Emailed(ticket))
}

pub async fn reset_password<E: Executor>(
    db: &E,
    ticket: &str,
    now: u64,
) -> Result<Option<String>, AuthError> {
    let rows = db.run(find_by_reset_hash(&hash_token(ticket), now)).await?;
    let Some(row) = rows.first() else {
        return Ok(None);
    };
    let id = row
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?
        .to_string();
    db.run(clear_reset_token(&id)).await?;
    db.run(revoke_user_refreshes(&id, "password_reset", now))
        .await?;
    db.run(deactivate_user_sessions(&id)).await?;
    Ok(Some(id))
}
