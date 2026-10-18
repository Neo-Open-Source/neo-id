use auth_core::AuthError;
use auth_db::Kv;

pub async fn rate_limit_allow<K: Kv>(
    kv: &K,
    key: &str,
    max: u32,
    window_secs: u64,
) -> Result<bool, AuthError> {
    let used = kv
        .get(key)
        .await?
        .and_then(|bytes| String::from_utf8(bytes).ok())
        .and_then(|text| text.parse::<u32>().ok())
        .unwrap_or(0);
    if used >= max {
        return Ok(false);
    }
    kv.put(key, (used + 1).to_string().as_bytes(), window_secs)
        .await?;
    Ok(true)
}
