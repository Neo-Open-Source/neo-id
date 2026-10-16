#![allow(
    clippy::missing_errors_doc,
    reason = "generated code has no fallible API of its own"
)]
#![allow(
    clippy::pedantic,
    reason = "generated code follows prost conventions, not ours"
)]

pub mod auth {
    pub mod v1 {
        include!(concat!(env!("OUT_DIR"), "/auth.v1.rs"));
    }
}
