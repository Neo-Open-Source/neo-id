use auth_accounts::CodeOutcome;
use auth_core::AuthError;
use worker::{Request, Response, Result, RouteContext};

use super::{
    mail::mailer,
    respond::{fail, ok},
    routes::{
        Ctx, authed_from, body_field, cookie_value, fail_status, header_opt, json_body, kv_store,
        load_cx, mint_response, worker_rng,
    },
};

async fn send_login_code<R: rand_core::RngCore + rand_core::CryptoRng>(
    cx: &Ctx,
    rng: &mut R,
    user: &auth_accounts::LoginUser,
) -> Result<CodeOutcome, AuthError> {
    match auth_accounts::request_email_code(&cx.db, rng, &user.id, "mfa_login", None, cx.now)
        .await?
    {
        CodeOutcome::Sent(code) => {
            let mailer = mailer(cx)?;
            mailer
                .send(&user.email, "login_code", Some(&code), None)
                .await?;
            Ok(CodeOutcome::Sent(code))
        }
        CodeOutcome::Cooldown(remaining) => Ok(CodeOutcome::Cooldown(remaining)),
    }
}
#[cfg(feature = "passkeys")]
use db::Kv as _;

pub async fn lite_start(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match crate::captcha::reject_lite(&cx, &ctx, &body).await {
        Ok(None) => {}
        Ok(Some(response)) => return Ok(response),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    }
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let email = body_field(&body, "email");
    // Defence in depth on top of captcha: bound sends per email and per IP.
    let email_bucket = format!("rl:lite:{}", email.trim().to_lowercase());
    let ip_bucket = format!(
        "rl:lite-ip:{}",
        header_opt(&req, "cf-connecting-ip").unwrap_or_default()
    );
    for (bucket, max) in [(&email_bucket, 5u32), (&ip_bucket, 20u32)] {
        match auth_accounts::rate_limit_allow(&store, bucket, max, 3600).await {
            Ok(true) => {}
            Ok(false) => return fail_status(&cx, 429, "RATE_LIMITED", "Too many requests"),
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        }
    }
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let account = match auth_accounts::lite_account(&cx.db, email).await {
        Ok(Some(account)) => account,
        Ok(None) => {
            return crate::respond::ok_message(
                &cx.request_id,
                cx.now_ms,
                &auth_proto::auth::v1::LiteStartResponse {
                    attempt_id: String::new(),
                    mfa_methods: Vec::new(),
                    passkey_available: false,
                    email_hint: None,
                    sent: false,
                },
                200,
            );
        }
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let methods = auth_accounts::lite_methods(&account);
    let attempt_id = auth_core::generate_id(&mut rng);
    let challenge = auth_accounts::MfaChallenge {
        user_id: account.user.id.clone(),
        email: account.user.email.clone(),
        role: account.user.role.clone(),
        totp: methods.totp,
        email_mfa: methods.email,
        passkey: methods.passkey,
    };
    if let Err(err) = auth_accounts::store_challenge(&store, &attempt_id, &challenge).await {
        return fail(&cx.request_id, cx.now_ms, &err);
    }
    let mut list = Vec::new();
    if methods.totp {
        list.push("totp".to_string());
    }
    if methods.email {
        list.push("email".to_string());
    }
    if methods.passkey {
        list.push("passkey".to_string());
    }
    let mut sent = false;
    if methods.email {
        match send_login_code(&cx, &mut rng, &account.user).await {
            Ok(CodeOutcome::Sent(_)) => sent = true,
            Ok(CodeOutcome::Cooldown(_)) => {}
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        }
    }
    crate::respond::ok_message(
        &cx.request_id,
        cx.now_ms,
        &auth_proto::auth::v1::LiteStartResponse {
            attempt_id,
            mfa_methods: list,
            passkey_available: methods.passkey,
            email_hint: methods.email.then(|| account.user.email.clone()),
            sent,
        },
        200,
    )
}

pub async fn email_request(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let attempt_id = body_field(&body, "attempt_id");
    let user = match auth_accounts::load_challenge(&store, attempt_id).await {
        Ok(Some(challenge)) => auth_accounts::LoginUser {
            id: challenge.user_id,
            email: challenge.email,
            role: challenge.role,
        },
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match send_login_code(&cx, &mut rng, &user).await {
        Ok(CodeOutcome::Sent(_)) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"sent": true}),
            200,
        ),
        Ok(CodeOutcome::Cooldown(remaining)) => {
            fail_status(&cx, 429, "RATE_LIMITED", &format!("Retry in {remaining}s"))
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn email_verify(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
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
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let attempt_id = body_field(&body, "attempt_id");
    let user = match auth_accounts::load_challenge(&store, attempt_id).await {
        Ok(Some(challenge)) => auth_accounts::LoginUser {
            id: challenge.user_id,
            email: challenge.email,
            role: challenge.role,
        },
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::verify_email_code(
        &cx.db,
        &user.id,
        "mfa_login",
        body_field(&body, "code"),
        cx.now,
    )
    .await
    {
        Ok(true) => {
            if let Err(err) = auth_accounts::clear_challenge(&store, attempt_id).await {
                return fail(&cx.request_id, cx.now_ms, &err);
            }
            mint_response(&cx, &req, &mut rng, &user).await
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

pub async fn totp_setup(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let sub = match authed_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) {
        Ok(sub) => sub,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let user = match auth_accounts::load_user_by_id(&cx.db, &sub).await {
        Ok(user) => user,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::totp_begin(&cx.db, &mut rng, &user.id, &user.email).await {
        Ok(setup) => ok(
            &cx.request_id,
            cx.now_ms,
            &serde_json::json!({"uri": setup.uri}),
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn totp_enable(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    totp_toggle(req, ctx, true).await
}

pub async fn totp_disable(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    totp_toggle(req, ctx, false).await
}

async fn totp_toggle(mut req: Request, ctx: RouteContext<()>, enable: bool) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let sub = match authed_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) {
        Ok(sub) => sub,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let user = match auth_accounts::load_user_by_id(&cx.db, &sub).await {
        Ok(user) => user,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let code = body_field(&body, "code");
    let done = if enable {
        auth_accounts::totp_enable(&cx.db, &user.id, code, cx.now).await
    } else {
        auth_accounts::totp_disable(&cx.db, &user.id, code, cx.now).await
    };
    match done {
        Ok(enabled) => crate::respond::ok_message(
            &cx.request_id,
            cx.now_ms,
            &auth_proto::auth::v1::EnabledResponse { enabled },
            200,
        ),
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

pub async fn totp_verify(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
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
    let attempt_id = body_field(&body, "attempt_id");
    let store = match kv_store(&ctx) {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let user = match auth_accounts::load_challenge(&store, attempt_id).await {
        Ok(Some(challenge)) => auth_accounts::LoginUser {
            id: challenge.user_id,
            email: challenge.email,
            role: challenge.role,
        },
        Ok(None) => return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials),
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::totp_check(&cx.db, &user.id, body_field(&body, "code"), cx.now).await {
        Ok(true) => {
            if let Err(err) = auth_accounts::clear_challenge(&store, attempt_id).await {
                return fail(&cx.request_id, cx.now_ms, &err);
            }
            mint_response(&cx, &req, &mut rng, &user).await
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

#[cfg(feature = "passkeys")]
fn passkey_rp(cx: &Ctx) -> Result<auth_core::PasskeyRp, AuthError> {
    auth_core::PasskeyRp::new(&cx.app.rp_id, &cx.app.rp_origin)
}

#[cfg(feature = "passkeys")]
async fn kv_put(ctx: &RouteContext<()>, key: &str, value: &[u8]) -> Result<(), AuthError> {
    let store = match ctx.env.kv("STATES") {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return Err(AuthError::Internal),
    };
    store.put(key, value, 300).await
}

#[cfg(feature = "passkeys")]
async fn kv_take(ctx: &RouteContext<()>, key: &str) -> Result<Vec<u8>, AuthError> {
    let store = match ctx.env.kv("STATES") {
        Ok(store) => crate::kv::StatesKv::new(store),
        Err(_) => return Err(AuthError::Internal),
    };
    let bytes = match store.get(key).await {
        Ok(Some(bytes)) => bytes,
        Ok(None) => return Err(AuthError::InvalidCredentials),
        Err(err) => return Err(err),
    };
    store.delete(key).await?;
    Ok(bytes)
}

#[cfg(feature = "passkeys")]
fn raw_options(json: &str) -> Result<serde_json::Value, AuthError> {
    serde_json::from_str(json).map_err(|_| AuthError::Internal)
}

#[cfg(feature = "passkeys")]
pub async fn passkey_register_start(req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let sub = match authed_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) {
        Ok(sub) => sub,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let user = match auth_accounts::load_user_by_id(&cx.db, &sub).await {
        Ok(user) => user,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let rp = match passkey_rp(&cx) {
        Ok(rp) => rp,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::register_begin(&cx.db, &rp, &user.id, &user.email).await {
        Ok((options, state)) => {
            let state_id = cx.request_id.clone();
            match kv_put(&ctx, &format!("mfa:pkreg:{state_id}"), &state).await {
                Ok(()) => {}
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            }
            let options = match raw_options(&options) {
                Ok(options) => options,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({"options": options, "state_id": state_id}),
                200,
            )
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

#[cfg(feature = "passkeys")]
pub async fn passkey_register_finish(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let sub = match authed_from(
        &cx,
        header_opt(&req, "authorization").as_deref(),
        cookie_value(header_opt(&req, "cookie").as_deref(), "neo_id_access").as_deref(),
    ) {
        Ok(sub) => sub,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let state_id = body_field(&body, "state_id");
    let state = match kv_take(&ctx, &format!("mfa:pkreg:{state_id}")).await {
        Ok(state) => state,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let rp = match passkey_rp(&cx) {
        Ok(rp) => rp,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::register_finish(&rp, body_field(&body, "response"), &state) {
        Ok(credential) => {
            let query = auth_db::insert_passkey(
                &sub,
                &credential.credential_id_b64,
                &credential.public_key_b64,
                Some(&credential.transports_json),
                credential.backup_eligible,
                credential.backup_state,
            );
            match cx.db.run(query).await {
                Ok(()) => ok(&cx.request_id, cx.now_ms, &serde_json::json!({}), 200),
                Err(err) => fail(&cx.request_id, cx.now_ms, &err),
            }
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

#[cfg(feature = "passkeys")]
pub async fn passkey_auth_start(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
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
    let rp = match passkey_rp(&cx) {
        Ok(rp) => rp,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    match auth_accounts::authenticate_begin(&cx.db, &rp, &user.id).await {
        Ok((options, state)) => {
            let state_id = cx.request_id.clone();
            match kv_put(&ctx, &format!("mfa:pkauth:{state_id}"), &state).await {
                Ok(()) => {}
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            }
            let options = match raw_options(&options) {
                Ok(options) => options,
                Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
            };
            ok(
                &cx.request_id,
                cx.now_ms,
                &serde_json::json!({"options": options, "state_id": state_id}),
                200,
            )
        }
        Err(err) => fail(&cx.request_id, cx.now_ms, &err),
    }
}

#[cfg(feature = "passkeys")]
pub async fn passkey_auth_finish(mut req: Request, ctx: RouteContext<()>) -> Result<Response> {
    let cx = match load_cx(&ctx.env) {
        Ok(cx) => cx,
        Err(err) => return fail("unknown", 0, &err),
    };
    let body = match json_body(&mut req).await {
        Ok(body) => body,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let state_id = body_field(&body, "state_id");
    let state = match kv_take(&ctx, &format!("mfa:pkauth:{state_id}")).await {
        Ok(state) => state,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let Ok(user) = auth_accounts::load_user(&cx.db, body_field(&body, "email")).await else {
        return fail(&cx.request_id, cx.now_ms, &AuthError::InvalidCredentials);
    };
    let rp = match passkey_rp(&cx) {
        Ok(rp) => rp,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    let verified =
        match auth_accounts::authenticate_finish(&rp, body_field(&body, "response"), &state) {
            Ok(verified) => verified,
            Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
        };
    match cx
        .db
        .run(auth_db::update_counter(
            &verified.credential_id_b64,
            verified.counter,
        ))
        .await
    {
        Ok(_) => {}
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    }
    let mut rng = match worker_rng() {
        Ok(rng) => rng,
        Err(err) => return fail(&cx.request_id, cx.now_ms, &err),
    };
    mint_response(&cx, &req, &mut rng, &user).await
}
