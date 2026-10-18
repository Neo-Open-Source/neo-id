use auth_core::{
    AuthError, RefreshDecision, encode_error, generate_token, hash_token, refresh_decision,
    refresh_expiry, session_expiry,
};
use auth_db::{
    Executor, create_refresh, find_refresh, find_session, find_user_by_id, parse_refresh,
    revoke_refresh, touch_login, touch_session,
};

use super::{
    Failure,
    login::{LoginUser, MintParams, sign_token_pair},
};
use auth_proto::auth::v1::TokenPair;

pub struct Rotation {
    pub minted: TokenPair,
    pub user: LoginUser,
}

pub async fn rotate_refresh<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    params: &MintParams<'_>,
    presented: &str,
) -> Result<Rotation, Failure> {
    let rows = db.run(find_refresh(&hash_token(presented))).await?;
    let row = rows.first().ok_or(Failure::Code("TOKEN_INVALID"))?;
    let token_id = row
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or(Failure::Auth(AuthError::MalformedMessage))?;
    let session_id = row
        .get("sessionId")
        .and_then(serde_json::Value::as_str)
        .map(String::from);
    let session_active = match session_id.as_deref() {
        None => false,
        Some(id) => db
            .run(find_session(id))
            .await?
            .first()
            .and_then(|row| row.get("isActive"))
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
    };
    let stored = parse_refresh(row, session_active)?;
    let user_id = stored.user_id.clone();
    match refresh_decision(&stored, now) {
        RefreshDecision::Reissue => {
            db.run(revoke_refresh(token_id, "rotated", now)).await?;
        }
        RefreshDecision::GraceReissue => {}
        failed => return Err(Failure::Code(encode_error(&failed))),
    }
    let session_id = session_id.ok_or(Failure::Code("INVALID_REQUEST"))?;
    db.run(touch_session(
        &session_id,
        params.device,
        params.ip,
        session_expiry(now),
    ))
    .await?;
    let users = db.run(find_user_by_id(&user_id)).await?;
    let user_row = users.first().ok_or(Failure::Code("TOKEN_INVALID"))?;
    let user = LoginUser {
        id: user_id,
        email: user_row
            .get("email")
            .and_then(serde_json::Value::as_str)
            .ok_or(Failure::Auth(AuthError::MalformedMessage))?
            .to_string(),
        role: user_row
            .get("role")
            .and_then(serde_json::Value::as_str)
            .ok_or(Failure::Auth(AuthError::MalformedMessage))?
            .to_string(),
    };
    let (access_token, id_token) = sign_token_pair(rng, params, &user, &session_id, now, 0, None)?;
    let refresh_token = generate_token(rng, auth_core::REFRESH_TOKEN_BYTES);
    db.run(create_refresh(
        &user.id,
        &session_id,
        &hash_token(&refresh_token),
        Some(token_id),
        params.device,
        params.ip,
        refresh_expiry(now),
    ))
    .await?;
    db.run(touch_login(&user.id, params.ip, now)).await?;
    Ok(Rotation {
        minted: TokenPair {
            access_token,
            refresh_token,
            id_token,
            session_id,
            expires_in: auth_core::ACCESS_TOKEN_TTL,
        },
        user,
    })
}
