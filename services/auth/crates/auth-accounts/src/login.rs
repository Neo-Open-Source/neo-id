use auth_core::{
    AccessInput, AuthError, CredentialId, Envelope, IdInput, OpaqueSetup, REFRESH_TOKEN_BYTES,
    generate_id, generate_token, hash_token, login_response, refresh_expiry, session_expiry,
    sign_access, sign_id,
};
use auth_db::{
    Executor, create_refresh, create_session, find_envelope, find_user_by_email, find_user_by_id,
    passkeys_by_user, touch_login,
};
use auth_proto::auth::v1::TokenPair;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

pub struct LoginUser {
    pub id: String,
    pub email: String,
    pub role: String,
}

pub struct LoginChallenge {
    pub user: LoginUser,
    pub response: Vec<u8>,
    pub state: Vec<u8>,
}

pub async fn load_user<E: Executor>(db: &E, email: &str) -> Result<LoginUser, AuthError> {
    let users = db.run(find_user_by_email(email)).await?;
    let user = users.first().ok_or(AuthError::InvalidCredentials)?;
    parse_user(user)
}

pub async fn load_user_by_id<E: Executor>(db: &E, user_id: &str) -> Result<LoginUser, AuthError> {
    let users = db.run(find_user_by_id(user_id)).await?;
    let user = users.first().ok_or(AuthError::InvalidCredentials)?;
    parse_user(user)
}

pub struct LiteAccount {
    pub user: LoginUser,
    pub totp: bool,
    pub email_mfa: bool,
    pub passkey: bool,
}

pub struct LiteMethods {
    pub totp: bool,
    pub email: bool,
    pub passkey: bool,
}

#[must_use]
pub fn lite_methods(account: &LiteAccount) -> LiteMethods {
    LiteMethods {
        totp: account.totp,
        email: account.email_mfa || (!account.totp && !account.passkey),
        passkey: account.passkey,
    }
}

pub async fn lite_account<E: Executor>(
    db: &E,
    email: &str,
) -> Result<Option<LiteAccount>, AuthError> {
    let users = db.run(find_user_by_email(email)).await?;
    let Some(row) = users.first() else {
        return Ok(None);
    };
    let enabled = |key: &str| {
        row.get(key)
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false)
    };
    let user = parse_user(row)?;
    let passkey = !db.run(passkeys_by_user(&user.id)).await?.is_empty();
    Ok(Some(LiteAccount {
        totp: enabled("totpEnabled"),
        email_mfa: enabled("emailMfaEnabled"),
        passkey,
        user,
    }))
}

fn parse_user(user: &serde_json::Value) -> Result<LoginUser, AuthError> {
    let field = |key: &str| {
        user.get(key)
            .and_then(serde_json::Value::as_str)
            .ok_or(AuthError::MalformedMessage)
    };
    Ok(LoginUser {
        id: field("id")?.to_string(),
        email: field("email")?.to_string(),
        role: field("role")?.to_string(),
    })
}

pub struct MintParams<'a> {
    pub private_pem: &'a [u8],
    pub issuer: &'a str,
    pub device: Option<&'a str>,
    pub ip: Option<&'a str>,
    pub audience: Option<&'a str>,
}

pub async fn start_login<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    setup: &OpaqueSetup,
    rng: &mut R,
    email: &str,
    request: &[u8],
) -> Result<LoginChallenge, AuthError> {
    let users = db.run(find_user_by_email(email)).await?;
    let user = users.first().ok_or(AuthError::InvalidCredentials)?;
    let id = user
        .get("id")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?
        .to_string();
    let row_email = user
        .get("email")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?
        .to_string();
    let role = user
        .get("role")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?
        .to_string();
    let envelopes = db.run(find_envelope(&id)).await?;
    let encoded = envelopes
        .first()
        .and_then(|row| row.get("envelope"))
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::InvalidCredentials)?;
    let raw = URL_SAFE_NO_PAD
        .decode(encoded)
        .map_err(|_| AuthError::InvalidCredentials)?;
    let envelope = Envelope::try_from_bytes(&raw).map_err(|_| AuthError::InvalidCredentials)?;
    let credential = CredentialId::try_from(id.as_bytes())?;
    let (response, state) = login_response(setup, &envelope, request, credential, rng)?;
    Ok(LoginChallenge {
        user: LoginUser {
            id,
            email: row_email,
            role,
        },
        response,
        state: state.into_bytes(),
    })
}

pub async fn complete_login<E: Executor, R: rand::RngCore + rand::CryptoRng>(
    db: &E,
    rng: &mut R,
    now: u64,
    params: &MintParams<'_>,
    user: &LoginUser,
) -> Result<TokenPair, AuthError> {
    let sessions = db
        .run(create_session(
            &user.id,
            params.device,
            params.ip,
            session_expiry(now),
        ))
        .await?;
    let session_id = sessions
        .first()
        .and_then(|row| row.get("id"))
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?;
    let (access_token, id_token) = sign_token_pair(rng, params, user, session_id, now, now)?;
    let refresh_token = generate_token(rng, REFRESH_TOKEN_BYTES);
    db.run(create_refresh(
        &user.id,
        session_id,
        &hash_token(&refresh_token),
        None,
        params.device,
        params.ip,
        refresh_expiry(now),
    ))
    .await?;
    db.run(touch_login(&user.id, params.ip, now)).await?;
    Ok(TokenPair {
        access_token,
        refresh_token,
        id_token,
        session_id: session_id.to_string(),
        expires_in: auth_core::ACCESS_TOKEN_TTL,
    })
}

pub(crate) fn sign_token_pair<R: rand::RngCore + rand::CryptoRng>(
    rng: &mut R,
    params: &MintParams<'_>,
    user: &LoginUser,
    session_id: &str,
    now: u64,
    auth_time: u64,
) -> Result<(String, String), AuthError> {
    let access_token = sign_access(
        params.private_pem,
        &AccessInput {
            sub: user.id.clone(),
            email: user.email.clone(),
            role: user.role.clone(),
            session_id: Some(session_id.to_string()),
            issuer: params.issuer.to_string(),
            issued_at: now,
            auth_time,
            scope: "openid profile email".to_string(),
            jti: generate_id(rng),
        },
    )?;
    let id_token = sign_id(
        params.private_pem,
        &IdInput {
            sub: user.id.clone(),
            email: user.email.clone(),
            audience: params.audience.unwrap_or(params.issuer).to_string(),
            issuer: params.issuer.to_string(),
            issued_at: now,
            auth_time,
            nonce: None,
            access_token: Some(access_token.clone()),
            jti: generate_id(rng),
        },
    )?;
    Ok((access_token, id_token))
}
