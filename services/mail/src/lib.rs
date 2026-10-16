#![allow(
    clippy::missing_errors_doc,
    reason = "MailError variants are the single source; per-fn sections would duplicate and drift"
)]

mod brand;
mod resend;
mod routes;
mod templates;

use worker::{Context, Env, Request, Response, Result};

#[worker::event(fetch)]
pub async fn main(req: Request, env: Env, _ctx: Context) -> Result<Response> {
    routes::router().run(req, env).await
}
