use auth_core::{AuthError, generate_token};
use auth_db::Kv;
use auth_proto::auth::v1::DeviceAuthorization;
use rand::{CryptoRng, RngCore};
use serde::Serialize;
use serde::de::DeserializeOwned;

const DEVICE_TTL: u64 = 300;
const CODE_ALPHABET: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STATUS_PENDING: &str = "pending";
const STATUS_APPROVED: &str = "approved";

pub struct DeviceStart {
    pub device_code: String,
    pub state: DeviceAuthorization,
}

pub enum DeviceStatus {
    Pending,
    Approved { user_id: String },
    Expired,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ApproveOutcome {
    Approved,
    Mismatch,
    Unknown,
}

fn device_key(device_code: &str) -> String {
    format!("device:{device_code}")
}

fn user_code_key(user_code: &str) -> String {
    format!("devuc:{}", user_code.to_uppercase())
}

fn user_code<R: RngCore>(rng: &mut R) -> String {
    let mut code = String::with_capacity(9);
    for index in 0..8 {
        if index == 4 {
            code.push('-');
        }
        let pick = (rng.next_u32() as usize) % CODE_ALPHABET.len();
        code.push(char::from(CODE_ALPHABET[pick]));
    }
    code
}

async fn put_json<K: Kv, T: Serialize>(kv: &K, key: &str, value: &T) -> Result<(), AuthError> {
    let bytes = serde_json::to_vec(value).map_err(|_| AuthError::Internal)?;
    kv.put(key, &bytes, DEVICE_TTL).await
}

async fn get_json<K: Kv, T: DeserializeOwned>(kv: &K, key: &str) -> Result<Option<T>, AuthError> {
    let Some(bytes) = kv.get(key).await? else {
        return Ok(None);
    };
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| AuthError::Internal)
}

fn expired(state: &DeviceAuthorization, now: u64) -> bool {
    now.saturating_sub(u64::try_from(state.created_at_unix).unwrap_or(0)) > DEVICE_TTL
}

pub async fn start_device<K: Kv, R: RngCore + CryptoRng>(
    kv: &K,
    rng: &mut R,
    now: u64,
    client_name: &str,
    ip: &str,
    user_agent: &str,
    expected_user_id: &str,
) -> Result<DeviceStart, AuthError> {
    let device_code = generate_token(rng, 32);
    let user_code = user_code(rng);
    let state = DeviceAuthorization {
        user_code: user_code.clone(),
        status: STATUS_PENDING.to_string(),
        user_id: String::new(),
        client_name: client_name.to_string(),
        ip: ip.to_string(),
        user_agent: user_agent.to_string(),
        created_at_unix: i64::try_from(now).unwrap_or(0),
        expected_user_id: expected_user_id.to_string(),
    };
    put_json(kv, &device_key(&device_code), &state).await?;
    kv.put(
        &user_code_key(&user_code),
        device_code.as_bytes(),
        DEVICE_TTL,
    )
    .await?;
    Ok(DeviceStart { device_code, state })
}

pub async fn approve<K: Kv>(
    kv: &K,
    user_code: &str,
    user_id: &str,
    now: u64,
) -> Result<ApproveOutcome, AuthError> {
    let Some(bytes) = kv.get(&user_code_key(user_code)).await? else {
        return Ok(ApproveOutcome::Unknown);
    };
    let device_code = String::from_utf8(bytes).unwrap_or_default();
    let Some(mut state) = get_json::<K, DeviceAuthorization>(kv, &device_key(&device_code)).await?
    else {
        return Ok(ApproveOutcome::Unknown);
    };
    if expired(&state, now) {
        return Ok(ApproveOutcome::Unknown);
    }
    if !state.expected_user_id.is_empty() && state.expected_user_id != user_id {
        return Ok(ApproveOutcome::Mismatch);
    }
    state.status = STATUS_APPROVED.to_string();
    state.user_id = user_id.to_string();
    put_json(kv, &device_key(&device_code), &state).await?;
    Ok(ApproveOutcome::Approved)
}

pub async fn poll<K: Kv>(kv: &K, device_code: &str, now: u64) -> Result<DeviceStatus, AuthError> {
    let Some(state) = get_json::<K, DeviceAuthorization>(kv, &device_key(device_code)).await?
    else {
        return Ok(DeviceStatus::Expired);
    };
    if expired(&state, now) {
        kv.delete(&device_key(device_code)).await?;
        return Ok(DeviceStatus::Expired);
    }
    if state.status == STATUS_APPROVED {
        kv.delete(&device_key(device_code)).await?;
        kv.delete(&user_code_key(&state.user_code)).await?;
        return Ok(DeviceStatus::Approved {
            user_id: state.user_id,
        });
    }
    Ok(DeviceStatus::Pending)
}
