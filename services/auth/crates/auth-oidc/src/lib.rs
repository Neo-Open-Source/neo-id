#![allow(
    clippy::missing_errors_doc,
    reason = "WireError variants are the single source; per-fn sections would duplicate and drift"
)]

mod authorize;
mod device;
mod logout;
mod register;
mod token;
mod userinfo;

pub use authorize::{
    AuthorizeOutcome, AuthorizeRequest, ConsentChoice, ConsentRequest, Redirect, WireError,
    authorize, decide_consent,
};
pub use device::{ApproveOutcome, DeviceStart, DeviceStatus, approve, poll, start_device};
pub use logout::{Logout, LogoutRequest, logout};
pub use register::{ClientRegistered, register};
pub use token::{Grant, TokenRequest, Tokens, store_authcode_state, take_authcode_state, token};
pub use userinfo::{UserInfoRequest, userinfo};

pub use auth_proto::auth::v1::{AuthorizationCode, ClientRegistrationRequest, UserInfo};
