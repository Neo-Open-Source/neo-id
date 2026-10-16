use auth_core::{AuthError, register_store};
use auth_db::{Executor, find_envelope, find_user_by_email, upsert_envelope};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

pub enum Availability {
    Fresh,
    Resume(String),
    Taken,
}

pub async fn check_email<E: Executor>(db: &E, email: &str) -> Result<Availability, AuthError> {
    let users = db.run(find_user_by_email(email)).await?;
    let Some(user) = users.first() else {
        return Ok(Availability::Fresh);
    };
    let id = user
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?;
    if db.run(find_envelope(id)).await?.is_empty() {
        Ok(Availability::Resume(id.to_string()))
    } else {
        Ok(Availability::Taken)
    }
}

pub async fn finish_registration<E: Executor>(
    db: &E,
    user_id: &str,
    upload: &[u8],
) -> Result<(), AuthError> {
    let envelope = register_store(upload)?;
    let encoded = URL_SAFE_NO_PAD.encode(envelope.as_bytes());
    db.run(upsert_envelope(user_id, &encoded)).await?;
    Ok(())
}
