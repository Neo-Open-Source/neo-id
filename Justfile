default:
    @just --list

# Full local quality gate: format, lint, test, supply chain. Run before push.
# (geiger is intentionally not here: it reports dependency unsafe, which is
# normal; our unsafe gate is workspace `deny(unsafe_code)` + clippy above.)
gate:
    cargo fmt --all -- --check
    cargo clippy --workspace --all-targets -- -D warnings -W clippy::pedantic
    cargo test --workspace
    cargo deny check
    cargo audit

# Unsafe census per crate, for dependency review (exit code ignored: report only).
geiger:
    #!/usr/bin/env bash
    for dir in services/auth/crates/*/ crates/*/; do (cd "$dir" && cargo geiger || true); done

fmt:
    cargo fmt --all

lint:
    cargo clippy --workspace --all-targets -- -D warnings -W clippy::pedantic

test:
    cargo test --workspace

deny:
    cargo deny check

audit:
    cargo audit

# Mutation testing on one file, e.g. `just mutants crates/auth-core/src/pkce.rs`
mutants file:
    cargo mutants -f {{ file }}

proto:
    buf lint proto
    buf generate proto
