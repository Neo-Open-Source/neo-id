use auth_core::{
    AuthError, CODE_EXPIRY, constant_time_equal, generate_code, generate_secret,
    resend_remaining_s, setup_uri, verify_totp,
};
use auth_db::{
    Executor, disable_totp, enable_totp, invalidate_pending, issue_code, latest_valid, mark_used,
    set_totp_secret, totp_secret,
};

pub enum CodeOutcome {
    Sent(String),
    Cooldown(u64),
}

pub async fn request_email_code<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    user_id: &str,
    purpose: &str,
    target_email: Option<&str>,
    now: u64,
) -> Result<CodeOutcome, AuthError> {
    if let Some(row) = db.run(latest_valid(user_id, purpose, now)).await?.first() {
        let created = row
            .get("createdAt")
            .and_then(serde_json::Value::as_u64)
            .unwrap_or(now);
        let remaining = resend_remaining_s(created, now);
        if remaining > 0 {
            return Ok(CodeOutcome::Cooldown(remaining));
        }
    }
    db.run(invalidate_pending(user_id, purpose, now)).await?;
    let code = generate_code(rng, 6);
    db.run(issue_code(
        user_id,
        purpose,
        &code,
        target_email,
        now + CODE_EXPIRY,
    ))
    .await?;
    Ok(CodeOutcome::Sent(code))
}

pub async fn verify_email_code<E: Executor>(
    db: &E,
    user_id: &str,
    purpose: &str,
    presented: &str,
    now: u64,
) -> Result<bool, AuthError> {
    let rows = db.run(latest_valid(user_id, purpose, now)).await?;
    let Some(row) = rows.first() else {
        return Ok(false);
    };
    let stored = row
        .get("code")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?;
    if !constant_time_equal(stored.as_bytes(), presented.as_bytes()) {
        return Ok(false);
    }
    let id = row
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?;
    db.run(mark_used(id, now)).await?;
    Ok(true)
}

pub struct TotpSetup {
    pub secret: String,
    pub uri: String,
}

pub async fn totp_begin<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    user_id: &str,
    email: &str,
) -> Result<TotpSetup, AuthError> {
    let secret = generate_secret(rng)?;
    let uri = setup_uri(&secret, email)?;
    db.run(set_totp_secret(user_id, &secret)).await?;
    Ok(TotpSetup { secret, uri })
}

async fn stored_secret<E: Executor>(db: &E, user_id: &str) -> Result<String, AuthError> {
    let rows = db.run(totp_secret(user_id)).await?;
    rows.first()
        .and_then(|row| row.get("totpSecret"))
        .and_then(serde_json::Value::as_str)
        .map(String::from)
        .ok_or(AuthError::InvalidCredentials)
}

pub async fn totp_enable<E: Executor>(
    db: &E,
    user_id: &str,
    code: &str,
    now: u64,
) -> Result<bool, AuthError> {
    if !verify_totp(&stored_secret(db, user_id).await?, code, now)? {
        return Ok(false);
    }
    db.run(enable_totp(user_id)).await?;
    Ok(true)
}

pub async fn totp_check<E: Executor>(
    db: &E,
    user_id: &str,
    code: &str,
    now: u64,
) -> Result<bool, AuthError> {
    verify_totp(&stored_secret(db, user_id).await?, code, now)
}

pub async fn totp_disable<E: Executor>(
    db: &E,
    user_id: &str,
    code: &str,
    now: u64,
) -> Result<bool, AuthError> {
    if !verify_totp(&stored_secret(db, user_id).await?, code, now)? {
        return Ok(false);
    }
    db.run(disable_totp(user_id)).await?;
    Ok(true)
}
