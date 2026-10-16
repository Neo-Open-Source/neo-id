use auth_core::AuthError;
use auth_db::{Executor as _, Kv as _};
use worker::{Request, Response, Result, RouteContext};

use super::{
    mail::mailer,
    respond::{fail, ok},
    routes::{Ctx, authed, body_field, json_body, kv_store, load_cx, worker_rng},
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

fn authed_user_id(cx: &Ctx, req: &Request) -> Result<String, AuthError> {
    authed(cx, req)
}

pub async fn sessions_list(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::list_sessions(&cx.db, &user_id).await {
        Ok(rows) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"sessions": rows}),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn session_revoke(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let id = ctx.param("id").cloned().unwrap_or_default();
    match auth_accounts::revoke_session(&cx.db, &id, &user_id, cx.now).await {
        Ok(revoked) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"revoked": revoked}),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn sessions_revoke_all(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::revoke_all_sessions(&cx.db, &user_id, cx.now).await {
        Ok(()) => ok(&cx.request_id, cx.now_ms, &serde_json::json!({}), 200),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn profile_get(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let rows = match cx.db.run(auth_db::find_user_by_id(&user_id)).await {
        Ok(rows) => rows,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match rows.first() {
        Some(row) => ok(&cx.request_id, cx.now_ms, row, 200),
        None => fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
    }
}

pub async fn profile_update(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let field = |key: &str| {
        let value = body_field(&body, key);
        if value.is_empty() { None } else { Some(value) }
    };
    match auth_accounts::update_user_profile(
        &cx.db,
        &user_id,
        field("displayName"),
        field("firstName"),
        field("lastName"),
    )
    .await
    {
        Ok(()) => ok(&cx.request_id, cx.now_ms, &serde_json::json!({}), 200),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn email_request(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::change_email_request(&cx.db, &mut rng, &user_id, cx.now).await {
        Ok(auth_accounts::CodeOutcome::Sent(code)) => {
            let target = body_field(&body, "new_email");
            let mailer = match mailer(&cx) {
                Ok(mailer) => mailer,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            if mailer
                .send(target, "verify_email", Some(&code), None)
                .await
                .is_err()
            {
                return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
            }
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({"sent": true}),
                200,
            )
        }
        Ok(auth_accounts::CodeOutcome::Cooldown(remaining)) => fail_cooldown(&cx, remaining),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

fn fail_cooldown(cx: &Ctx, remaining: u64) -> Result<Response> {
    Response::from_json(&serde_json::json!({
        "ok": false,
        "error": {"code": "RATE_LIMITED", "message": "Too many requests", "status": 429, "retryAfter": remaining},
        "meta": {"request_id": cx.request_id, "timestamp": cx.now_ms},
    }))
    .map(|response| response.with_status(429))
}

pub async fn email_confirm(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::change_email_confirm(
        &cx.db,
        &user_id,
        body_field(&body, "new_email"),
        body_field(&body, "code"),
        cx.now,
    )
    .await
    {
        Ok(true) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"changed": true}),
            200,
        ),
        Ok(false) => fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn verify_email_request(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(user) = auth_accounts::load_user_by_id(&cx.db, &user_id).await else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials);
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::request_email_code(
        &cx.db,
        &mut rng,
        &user_id,
        "verify_email",
        None,
        cx.now,
    )
    .await
    {
        Ok(auth_accounts::CodeOutcome::Sent(code)) => {
            let mailer = match mailer(&cx) {
                Ok(mailer) => mailer,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            if mailer
                .send(&user.email, "verify_email", Some(&code), None)
                .await
                .is_err()
            {
                return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
            }
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({"sent": true}),
                200,
            )
        }
        Ok(auth_accounts::CodeOutcome::Cooldown(remaining)) => fail_cooldown(&cx, remaining),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn verify_email_confirm(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(user) = auth_accounts::load_user(&cx.db, body_field(&body, "email")).await else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials);
    };
    match auth_accounts::confirm_email(&cx.db, &user.id, body_field(&body, "code"), cx.now).await {
        Ok(true) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"verified": true}),
            200,
        ),
        Ok(false) => fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn password_forgot(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::forgot_password(&cx.db, &mut rng, body_field(&body, "email"), cx.now).await
    {
        Ok(auth_accounts::ForgotOutcome::Emailed(ticket)) => {
            let link = format!("{}/auth/reset-password?ticket={ticket}", cx.app.web_origin);
            let mailer = match mailer(&cx) {
                Ok(mailer) => mailer,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            if mailer
                .send(
                    body_field(&body, "email"),
                    "reset_password",
                    None,
                    Some(&link),
                )
                .await
                .is_err()
            {
                return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
            }
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({"sent": true}),
                200,
            )
        }
        Ok(auth_accounts::ForgotOutcome::Unknown) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"sent": true}),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn password_reset(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::reset_password(&cx.db, body_field(&body, "ticket"), cx.now).await {
        Ok(Some(user_id)) => {
            let grant = auth_core::generate_id(&mut rng);
            let store = match kv_store(&ctx) {
                Ok(store) => crate::kv::StatesKv::new(store),
                Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
            };
            if store
                .put(&format!("pwdreset:{grant}"), user_id.as_bytes(), 600)
                .await
                .is_err()
            {
                return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
            }
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({"user_id": user_id, "reset_grant": grant}),
                200,
            )
        }
        Ok(None) => fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn password_change(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let user_id = match authed_user_id(&cx, &req) {
        Ok(id) => id,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(upload) = URL_SAFE_NO_PAD.decode(body_field(&body, "upload")) else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::MalformedMessage);
    };
    match auth_accounts::finish_registration(&cx.db, &user_id, &upload).await {
        Ok(()) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"changed": true}),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}
