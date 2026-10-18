use auth_core::AuthError;
use worker::{Response, Result};

pub fn ok(
    request_id: &str,
    now_ms: u64,
    data: &serde_json::Value,
    status: u16,
) -> Result<Response> {
    Response::from_json(&serde_json::json!({
        "ok": true,
        "data": data,
        "meta": {"request_id": request_id, "timestamp": now_ms},
    }))
    .map(|response| response.with_status(status))
}

pub fn ok_message<T: serde::Serialize>(
    request_id: &str,
    now_ms: u64,
    message: &T,
    status: u16,
) -> Result<Response> {
    match serde_json::to_value(message) {
        Ok(data) => ok(request_id, now_ms, &data, status),
        Err(_) => fail(request_id, now_ms, &AuthError::Internal),
    }
}

pub fn fail(request_id: &str, now_ms: u64, err: &AuthError) -> Result<Response> {
    let (code, message, status) = match &err {
        AuthError::MalformedMessage => ("INVALID_REQUEST", "Malformed request", 400),
        AuthError::InvalidCredentials => ("INVALID_CREDENTIALS", "Invalid credentials", 401),
        AuthError::Internal => ("INTERNAL", "Internal error", 500),
    };
    Response::from_json(&serde_json::json!({
        "ok": false,
        "error": {"code": code, "message": message, "status": status},
        "meta": {"request_id": request_id, "timestamp": now_ms},
    }))
    .map(|response| response.with_status(status))
}

pub fn unauthorized(request_id: &str, now_ms: u64, description: &str) -> Result<Response> {
    let mut response = fail(request_id, now_ms, &AuthError::InvalidCredentials)?;
    let value = format!("Bearer error=\"invalid_token\", error_description=\"{description}\"");
    response
        .headers_mut()
        .append("www-authenticate", &value)
        .map_err(|_| worker::Error::RustError("header append failed".to_string()))?;
    Ok(response)
}

fn http_only_cookie(name: &str, value: &str, max_age: u64) -> String {
    format!("{name}={value}; Path=/; Max-Age={max_age}; HttpOnly; Secure; SameSite=Lax")
}

fn session_hint_cookie(name: &str, value: &str, max_age: u64) -> String {
    format!("{name}={value}; Path=/; Max-Age={max_age}; Secure; SameSite=Lax")
}

pub fn with_cookies(
    response: Result<Response>,
    access: &str,
    refresh: &str,
    max_age: u64,
) -> Result<Response> {
    let mut response = response?;
    let headers = response.headers_mut();
    headers
        .append(
            "set-cookie",
            &http_only_cookie("neo_id_access", access, max_age),
        )
        .and(headers.append(
            "set-cookie",
            &http_only_cookie("neo_id_refresh", refresh, max_age),
        ))
        .and(headers.append(
            "set-cookie",
            &session_hint_cookie("neo_id_session", "1", max_age),
        ))
        .map_err(|_| worker::Error::RustError("cookie append failed".to_string()))?;
    Ok(response)
}

pub fn cleared_cookies(response: Result<Response>) -> Result<Response> {
    let mut response = response?;
    let headers = response.headers_mut();
    headers
        .append("set-cookie", "neo_id_access=; Path=/; Max-Age=0")
        .and(headers.append("set-cookie", "neo_id_refresh=; Path=/; Max-Age=0"))
        .and(headers.append("set-cookie", "neo_id_session=; Path=/; Max-Age=0"))
        .map_err(|_| worker::Error::RustError("cookie append failed".to_string()))?;
    Ok(response)
}

pub fn no_store(response: Result<Response>) -> Result<Response> {
    let mut response = response?;
    let headers = response.headers_mut();
    headers
        .append("cache-control", "no-store")
        .and(headers.append("pragma", "no-cache"))
        .map_err(|_| worker::Error::RustError("header append failed".to_string()))?;
    Ok(response)
}

#[cfg(test)]
mod tests {
    use super::{http_only_cookie, session_hint_cookie};

    #[test]
    fn token_cookie_is_http_only() {
        assert_eq!(
            http_only_cookie("neo_id_access", "tok", 100),
            "neo_id_access=tok; Path=/; Max-Age=100; HttpOnly; Secure; SameSite=Lax"
        );
    }

    #[test]
    fn session_hint_cookie_is_script_readable() {
        assert_eq!(
            session_hint_cookie("neo_id_session", "1", 100),
            "neo_id_session=1; Path=/; Max-Age=100; Secure; SameSite=Lax"
        );
    }
}
