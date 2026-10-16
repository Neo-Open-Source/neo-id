#![allow(
    clippy::missing_errors_doc,
    reason = "WireError variants are the single source; per-fn sections would duplicate and drift"
)]

mod authorize;
mod logout;
mod register;
mod token;
mod userinfo;

pub use authorize::{
    AuthorizeOutcome, AuthorizeRequest, ConsentChoice, ConsentRequest, Redirect, WireError,
    authorize, decide_consent,
};
pub use logout::{Logout, LogoutRequest, logout};
pub use register::{ClientRegistered, RegisterRequest, register};
pub use token::{Grant, TokenRequest, Tokens, token};
pub use userinfo::{UserInfo, UserInfoRequest, userinfo};
