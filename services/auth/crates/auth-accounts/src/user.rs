use auth_core::AuthError;
use auth_db::{Executor, set_email, set_email_verified, update_profile};

use super::mfa::{CodeOutcome, request_email_code, verify_email_code};

pub async fn update_user_profile<E: Executor>(
    db: &E,
    user_id: &str,
    display_name: Option<&str>,
    first_name: Option<&str>,
    last_name: Option<&str>,
) -> Result<(), AuthError> {
    db.run(update_profile(user_id, display_name, first_name, last_name))
        .await?;
    Ok(())
}

pub async fn change_email_request<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    user_id: &str,
    now: u64,
) -> Result<CodeOutcome, AuthError> {
    request_email_code(db, rng, user_id, "change_email", None, now).await
}

pub async fn change_email_confirm<E: Executor>(
    db: &E,
    user_id: &str,
    new_email: &str,
    code: &str,
    now: u64,
) -> Result<bool, AuthError> {
    if !verify_email_code(db, user_id, "change_email", code, now).await? {
        return Ok(false);
    }
    db.run(set_email(user_id, new_email)).await?;
    Ok(true)
}

pub async fn confirm_email<E: Executor>(
    db: &E,
    user_id: &str,
    code: &str,
    now: u64,
) -> Result<bool, AuthError> {
    if !verify_email_code(db, user_id, "verify_email", code, now).await? {
        return Ok(false);
    }
    db.run(set_email_verified(user_id)).await?;
    Ok(true)
}
