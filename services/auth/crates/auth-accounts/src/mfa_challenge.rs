use auth_core::AuthError;
use auth_db::Kv;
use auth_proto::auth::v1::MfaChallenge;

const CHALLENGE_TTL: u64 = 300;
const MAX_ATTEMPTS: u32 = 5;

fn challenge_key(id: &str) -> String {
    format!("mfa:{id}")
}

pub async fn store_challenge<K: Kv>(
    kv: &K,
    id: &str,
    challenge: &MfaChallenge,
) -> Result<(), AuthError> {
    let bytes = serde_json::to_vec(challenge).map_err(|_| AuthError::Internal)?;
    kv.put(&challenge_key(id), &bytes, CHALLENGE_TTL).await
}

pub async fn load_challenge<K: Kv>(kv: &K, id: &str) -> Result<Option<MfaChallenge>, AuthError> {
    let Some(bytes) = kv.get(&challenge_key(id)).await? else {
        return Ok(None);
    };
    serde_json::from_slice(&bytes)
        .map(Some)
        .map_err(|_| AuthError::Internal)
}

pub async fn clear_challenge<K: Kv>(kv: &K, id: &str) -> Result<(), AuthError> {
    kv.delete(&challenge_key(id)).await
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Attempt {
    Allowed,
    Locked,
}

pub async fn fail_attempt<K: Kv>(kv: &K, id: &str) -> Result<Attempt, AuthError> {
    let key = format!("mfa:{id}:fail");
    let used = kv
        .get(&key)
        .await?
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|text| text.parse::<u32>().ok())
        .unwrap_or(0);
    let next = used + 1;
    if next >= MAX_ATTEMPTS {
        kv.delete(&key).await?;
        clear_challenge(kv, id).await?;
        return Ok(Attempt::Locked);
    }
    kv.put(&key, next.to_string().as_bytes(), CHALLENGE_TTL)
        .await?;
    Ok(Attempt::Allowed)
}
