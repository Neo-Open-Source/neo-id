use auth_core::AuthError;
use worker::{Request, Response, Result, RouteContext};

use crate::respond::{fail, ok_message};
use crate::routes::{
    authed_from, body_field, captcha_rejection, cookie_value, fail_status, header_opt, json_body,
    kv_store, load_cx, mint_response, worker_rng,
};

fn state_store(ctx: &RouteContext<()>) -> std::result::Result<crate::kv::StatesKv, AuthError> {
    kv_store(ctx).map(crate::kv::StatesKv::new)
}

fn token_status(cx: &crate::routes::Ctx, status: &str) -> Result<Response> {
    let message = auth_proto::auth::v1::DeviceTokenStatus {
        status: status.to_string(),
    };
    ok_message(&cx.request_id, cx.now_ms, &message, 200)
}

pub async fn authorize_device(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let store = match state_store(&ctx) {
        Ok(store) => store,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let attempt_id = body_field(&body, "attempt_id");
    let expected_user_id = if attempt_id.is_empty() {
        match captcha_rejection(&cx, &req, &body).await {
            Ok(None) => {}
            Ok(Some(response)) => return Ok(response),
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        }
        String::new()
    } else {
        match auth_accounts::load_challenge(&store, attempt_id).await {
            Ok(Some(challenge)) => challenge.user_id,
            Ok(None) => return fail_status(&cx, 400, "INVALID_ATTEMPT", "Unknown attempt"),
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        }
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let ip = header_opt(&req, "cf-connecting-ip").unwrap_or_default();
    let user_agent = header_opt(&req, "user-agent").unwrap_or_default();
    match auth_oidc::start_device(
        &store,
        &mut rng,
        cx.now,
        body_field(&body, "client_name"),
        &ip,
        &user_agent,
        &expected_user_id,
    )
    .await
    {
        Ok(start) => {
            let base = &cx.app.web_origin;
            let response = auth_proto::auth::v1::DeviceAuthorizationResponse {
                device_code: start.device_code,
                user_code: start.state.user_code.clone(),
                verification_uri: format!("{base}/device"),
                verification_uri_complete: format!("{base}/device?code={}", start.state.user_code),
                expires_in: 300,
                interval: 5,
            };
            ok_message(&cx.request_id, cx.now_ms, &response, 200)
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn approve_device(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let user_id = match authed_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) {
        Ok(user_id) => user_id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let store = match state_store(&ctx) {
        Ok(store) => store,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_oidc::approve(&store, body_field(&body, "user_code"), &user_id, cx.now).await {
        Ok(auth_oidc::ApproveOutcome::Approved) => ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::ApprovedResponse { approved: true },
            200,
        ),
        Ok(auth_oidc::ApproveOutcome::Mismatch) => fail_status(
            &cx,
            403,
            "WRONG_ACCOUNT",
            "This code belongs to a different account",
        ),
        Ok(auth_oidc::ApproveOutcome::Unknown) => {
            fail_status(&cx, 400, "INVALID_CODE", "Unknown or expired code")
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn device_token(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let store = match state_store(&ctx) {
        Ok(store) => store,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_oidc::poll(&store, body_field(&body, "device_code"), cx.now).await {
        Ok(auth_oidc::DeviceStatus::Pending) => token_status(&cx, "pending"),
        Ok(auth_oidc::DeviceStatus::Expired) => token_status(&cx, "expired"),
        Ok(auth_oidc::DeviceStatus::Approved { user_id }) => {
            let user = match auth_accounts::load_user_by_id(&cx.db, &user_id).await {
                Ok(user) => user,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            let mut rng = match worker_rng() {
                Ok(rng) => rng,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            mint_response(&cx, &req, &mut rng, &user).await
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

#[cfg(test)]
mod tests {
    use auth_proto::auth::v1::DeviceAuthorizationResponse;

    #[test]
    fn response_serializes_snake_case_wire() {
        let response = DeviceAuthorizationResponse {
            device_code: "d".into(),
            user_code: "u".into(),
            verification_uri: "v".into(),
            verification_uri_complete: "c".into(),
            expires_in: 300,
            interval: 5,
        };
        let value = serde_json::to_value(&response).unwrap();
        assert!(value.get("device_code").is_some());
        assert!(value.get("user_code").is_some());
        assert!(value.get("verification_uri_complete").is_some());
        assert!(value.get("expires_in").is_some());
        assert!(value.get("deviceCode").is_none());
    }
}
