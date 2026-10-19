use auth_core::{
    AuthError, AuthenticationState, DiscoverableAuthenticationState, PasskeyRp, RegistrationState,
    StoredCredential, authentication_options, discoverable_authentication_options,
    identify_discoverable, registration_options, require_resident_key, user_uuid,
    verify_authentication, verify_discoverable, verify_registration,
};
use auth_db::{Executor, passkey_by_credential, passkeys_by_user};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

fn stored(row: &serde_json::Value) -> Result<StoredCredential, AuthError> {
    let b64 = |key: &str| {
        row.get(key)
            .and_then(serde_json::Value::as_str)
            .ok_or(AuthError::MalformedMessage)
            .and_then(|text| {
                URL_SAFE_NO_PAD
                    .decode(text)
                    .map_err(|_| AuthError::MalformedMessage)
            })
    };
    Ok(StoredCredential {
        id: b64("credentialId")?,
        key: b64("publicKey")?,
        counter: row
            .get("counter")
            .and_then(serde_json::Value::as_u64)
            .and_then(|n| u32::try_from(n).ok())
            .unwrap_or(0),
        transports: row
            .get("transports")
            .and_then(serde_json::Value::as_str)
            .and_then(|raw| serde_json::from_str(raw).ok())
            .unwrap_or_default(),
        backup_eligible: row
            .get("backupEligible")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
        backup_state: row
            .get("backupState")
            .and_then(serde_json::Value::as_bool)
            .unwrap_or(false),
    })
}

async fn credentials<E: Executor>(
    db: &E,
    user_id: &str,
) -> Result<Vec<StoredCredential>, AuthError> {
    db.run(passkeys_by_user(user_id))
        .await?
        .iter()
        .map(stored)
        .collect()
}

pub async fn register_begin<E: Executor>(
    db: &E,
    rp: &PasskeyRp,
    user_id: &str,
    user_name: &str,
) -> Result<(String, Vec<u8>), AuthError> {
    let (options, state) = registration_options(
        rp,
        user_uuid(user_id),
        user_name,
        &credentials(db, user_id).await?,
    )?;
    let json =
        serde_json::to_string(&require_resident_key(options)).map_err(|_| AuthError::Internal)?;
    Ok((json, state.to_bytes()?))
}

pub struct NewCredential {
    pub credential_id_b64: String,
    pub public_key_b64: String,
    pub transports_json: String,
    pub counter: u32,
    pub backup_eligible: bool,
    pub backup_state: bool,
}

pub fn register_finish(
    rp: &PasskeyRp,
    response_json: &str,
    state_bytes: &[u8],
) -> Result<NewCredential, AuthError> {
    let state = RegistrationState::from_bytes(state_bytes)?;
    let credential = verify_registration(rp, response_json, &state)?;
    Ok(NewCredential {
        credential_id_b64: URL_SAFE_NO_PAD.encode(&credential.id),
        public_key_b64: URL_SAFE_NO_PAD.encode(&credential.key),
        transports_json: serde_json::to_string(&credential.transports)
            .map_err(|_| AuthError::Internal)?,
        counter: credential.counter,
        backup_eligible: credential.backup_eligible,
        backup_state: credential.backup_state,
    })
}

pub async fn authenticate_begin<E: Executor>(
    db: &E,
    rp: &PasskeyRp,
    user_id: &str,
) -> Result<(String, Vec<u8>), AuthError> {
    let credentials = credentials(db, user_id).await?;
    if credentials.is_empty() {
        return Err(AuthError::InvalidCredentials);
    }
    let (options, state) = authentication_options(rp, &credentials)?;
    let json = serde_json::to_string(&options).map_err(|_| AuthError::Internal)?;
    Ok((json, state.to_bytes()?))
}

pub struct VerifiedCounter {
    pub credential_id_b64: String,
    pub counter: u32,
}

pub fn authenticate_finish(
    rp: &PasskeyRp,
    response_json: &str,
    state_bytes: &[u8],
) -> Result<VerifiedCounter, AuthError> {
    let state = AuthenticationState::from_bytes(state_bytes)?;
    let verified = verify_authentication(rp, response_json, &state)?;
    Ok(VerifiedCounter {
        credential_id_b64: URL_SAFE_NO_PAD.encode(&verified.credential_id),
        counter: verified.counter,
    })
}

pub fn discoverable_begin(rp: &PasskeyRp) -> Result<(String, Vec<u8>), AuthError> {
    let (options, state) = discoverable_authentication_options(rp)?;
    let json = serde_json::to_string(&options).map_err(|_| AuthError::Internal)?;
    Ok((json, state.to_bytes()?))
}

pub fn discoverable_credential_id(
    rp: &PasskeyRp,
    response_json: &str,
) -> Result<String, AuthError> {
    let credential_id = identify_discoverable(rp, response_json)?;
    Ok(URL_SAFE_NO_PAD.encode(&credential_id))
}

pub async fn load_passkey<E: Executor>(
    db: &E,
    credential_id_b64: &str,
) -> Result<(String, StoredCredential), AuthError> {
    let rows = db.run(passkey_by_credential(credential_id_b64)).await?;
    let row = rows.first().ok_or(AuthError::InvalidCredentials)?;
    let user_id = row
        .get("userId")
        .and_then(serde_json::Value::as_str)
        .ok_or(AuthError::MalformedMessage)?
        .to_string();
    Ok((user_id, stored(row)?))
}

pub fn discoverable_finish(
    rp: &PasskeyRp,
    response_json: &str,
    state_bytes: &[u8],
    credential: &StoredCredential,
) -> Result<VerifiedCounter, AuthError> {
    let state = DiscoverableAuthenticationState::from_bytes(state_bytes)?;
    let verified = verify_discoverable(rp, response_json, &state, credential)?;
    Ok(VerifiedCounter {
        credential_id_b64: URL_SAFE_NO_PAD.encode(&verified.credential_id),
        counter: verified.counter,
    })
}
