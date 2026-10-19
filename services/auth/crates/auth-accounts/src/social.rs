use auth_core::{AuthError, generate_id};
use auth_db::{Executor, create_user, find_identity, find_user_by_email, insert_identity};

use crate::login::{LoginUser, load_user_by_id};

pub async fn resolve_social_user<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    provider: &str,
    provider_user_id: &str,
    email: &str,
    now: u64,
) -> Result<LoginUser, AuthError> {
    if let Some(row) = db
        .run(find_identity(provider, provider_user_id))
        .await?
        .first()
    {
        let user_id = row
            .get("userId")
            .and_then(serde_json::Value::as_str)
            .ok_or(AuthError::MalformedMessage)?;
        return load_user_by_id(db, user_id).await;
    }
    let user_id = if let Some(row) = db.run(find_user_by_email(email)).await?.first() {
        row.get("id")
            .and_then(serde_json::Value::as_str)
            .ok_or(AuthError::MalformedMessage)?
            .to_string()
    } else {
        let rows = db.run(create_user(email, now)).await?;
        rows.first()
            .and_then(|row| row.get("id"))
            .and_then(serde_json::Value::as_str)
            .ok_or(AuthError::Internal)?
            .to_string()
    };
    let identity_id = generate_id(rng);
    db.run(insert_identity(
        &identity_id,
        &user_id,
        provider,
        provider_user_id,
    ))
    .await?;
    load_user_by_id(db, &user_id).await
}
