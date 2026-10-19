use auth_core::AuthError;
use db::{Executor as _, Kv as _};
use worker::{Request, Response, Result, RouteContext};

use super::{
    mail::mailer,
    respond::{fail, ok},
    routes::{
        Ctx, authed_from, body_field, cookie_value, fail_status, header_opt, json_body, kv_store,
        load_cx, worker_rng,
    },
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};

fn authed_user_id(cx: &Ctx, req: &Request) -> Result<String, AuthError> {
    authed_from(
        cx,
        header_opt(req, "authorization").as_deref(),
        cookie_value(header_opt(req, "cookie").as_deref(), "neo_id_access").as_deref(),
    )
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
        Ok(revoked) => crate::respond::ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::RevokedResponse { revoked },
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
            crate::respond::ok_message(
                &cx.request_id,
                cx.now_ms,
                &auth_proto::auth::v1::SentResponse { sent: true },
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
        Ok(true) => crate::respond::ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::ChangedResponse { changed: true },
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
            crate::respond::ok_message(
                &cx.request_id,
                cx.now_ms,
                &auth_proto::auth::v1::SentResponse { sent: true },
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
        Ok(true) => crate::respond::ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::VerifiedResponse { verified: true },
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
    match crate::routes::captcha_rejection(&cx, &req, &body).await {
        Ok(None) => {}
        Ok(Some(response)) => return Ok(response),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    }
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
    };
    let bucket = format!(
        "rl:forgot:{}",
        body_field(&body, "email").trim().to_lowercase()
    );
    match auth_accounts::rate_limit_allow(&store, &bucket, 5, 3600).await {
        Ok(true) => {}
        Ok(false) => return fail_status(&cx, 429, "RATE_LIMITED", "Too many requests"),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    }
    match auth_accounts::forgot_password(&cx.db, &mut rng, body_field(&body, "email"), cx.now).await
    {
        Ok(auth_accounts::ForgotOutcome::Emailed(ticket)) => {
            let link = format!("{}/reset-password?ticket={ticket}", cx.app.web_origin);
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
            crate::respond::ok_message(
                &cx.request_id,
                cx.now_ms,
                &auth_proto::auth::v1::SentResponse { sent: true },
                200,
            )
        }
        Ok(auth_accounts::ForgotOutcome::Unknown) => crate::respond::ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::SentResponse { sent: true },
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
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
    };
    let bucket = format!(
        "rl:pwreset:{}",
        header_opt(&req, "cf-connecting-ip").unwrap_or_default()
    );
    match auth_accounts::rate_limit_allow(&store, &bucket, 10, 3600).await {
        Ok(true) => {}
        Ok(false) => return fail_status(&cx, 429, "RATE_LIMITED", "Too many requests"),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    }
    let ticket = body_field(&body, "ticket");
    let user_id = match auth_accounts::reset_ticket(&cx.db, ticket, cx.now).await {
        Ok(Some(id)) => id,
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let user = match auth_accounts::load_user_by_id(&cx.db, &user_id).await {
        Ok(user) => user,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let account = match auth_accounts::lite_account(&cx.db, &user.email).await {
        Ok(Some(account)) => account,
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    if auth_accounts::lite_methods(&account).totp {
        let attempt_id = auth_core::generate_id(&mut rng);
        let challenge = auth_accounts::MfaChallenge {
            user_id: account.user.id.clone(),
            email: account.user.email.clone(),
            role: account.user.role.clone(),
            totp: true,
            email_mfa: account.email_mfa,
            passkey: account.passkey,
        };
        if let Err(err) = auth_accounts::store_challenge(&store, &attempt_id, &challenge).await {
            return fail(&cx.request_id, cx.now_ms, &err);
        }
        return crate::respond::ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::PasswordResetResponse {
                mfa_required: true,
                mfa_methods: vec!["totp".to_string()],
                attempt_id: Some(attempt_id),
                user_id: None,
                reset_grant: None,
            },
            200,
        );
    }
    finish_password_reset(&cx, &mut rng, &store, ticket).await
}

pub async fn password_reset_verify(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
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
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return fail(&cx.request_id, cx.now_ms, &AuthError::Internal),
    };
    let attempt_id = body_field(&body, "attempt_id");
    let challenge = match auth_accounts::load_challenge(&store, attempt_id).await {
        Ok(Some(challenge)) => challenge,
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::totp_check(
        &cx.db,
        &challenge.user_id,
        body_field(&body, "code"),
        cx.now,
    )
    .await
    {
        Ok(true) => {
            if let Err(err) = auth_accounts::clear_challenge(&store, attempt_id).await {
                return fail(&cx.request_id, cx.now_ms, &err);
            }
            finish_password_reset(&cx, &mut rng, &store, body_field(&body, "ticket")).await
        }
        Ok(false) => {
            if let Err(err) = auth_accounts::fail_attempt(&store, attempt_id).await {
                return fail(&cx.request_id, cx.now_ms, &err);
            }
            fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials)
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

async fn finish_password_reset<R: rand_core::RngCore + rand_core::CryptoRng>(
    cx: &Ctx,
    rng: &mut R,
    store: &crate::kv::StatesKv,
    ticket: &str,
) -> Result<Response> {
    let user_id = match auth_accounts::reset_password(&cx.db, ticket, cx.now).await {
        Ok(Some(id)) => id,
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let grant = auth_core::generate_id(rng);
    if store
        .put(&format!("pwdreset:{grant}"), user_id.as_bytes(), 600)
        .await
        .is_err()
    {
        return fail(&cx.request_id, cx.now_ms, &AuthError::Internal);
    }
    crate::respond::ok_message(
        &cx.request_id,
        cx.now_ms,
        &auth_proto::auth::v1::PasswordResetResponse {
            mfa_required: false,
            mfa_methods: Vec::new(),
            attempt_id: None,
            user_id: Some(user_id),
            reset_grant: Some(grant),
        },
        200,
    )
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
