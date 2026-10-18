#![allow(
    clippy::missing_errors_doc,
    reason = "AuthError variants are the single source; per-fn sections would duplicate and drift"
)]

mod account;
mod captcha;
mod device;
mod env;
mod kv;
mod mail;
mod mfa;
mod neon;
mod oidc;
mod respond;
mod routes;
#[cfg(test)]
mod test_support;

use worker::{Context, Env, Request, Response, Result};

#[worker::event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    routes::router().run(req, env).await
}
