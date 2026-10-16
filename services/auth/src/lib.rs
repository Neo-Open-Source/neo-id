//! Worker entry point: `#[event(fetch)]` wiring lives here (phase 4).
//!
//! All logic stays in `crates/*`. This crate only adapts Workers requests
//! to crate calls and maps typed errors to HTTP responses.
