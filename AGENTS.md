# neo-auth — Rust OIDC provider (branch `refactoring`)

Rust (edition 2024, MSRV 1.85) on Cloudflare Workers via `workers-rs`, free tier.
10ms CPU/request ⇒ **no server-side password KDF**: OPAQUE (RFC 9807, `opaque-ke`),
Argon2id runs on the user device.

Microservices on one Cloudflare account: one Rust worker + one SvelteKit app
per domain, front and API served together on that single domain (no public API
subdomain, no per-app HTTP proxy). Domains: `auth.neome.uk` (auth),
`id.neome.uk` (account), `dev.neome.uk` (developer), `panel.neome.uk` (admin).
Models: `proto/` (buf), written once. No extra *.md files without owner approval.

## Commands

```sh
nix develop
just gate            # full local gate: fmt check + clippy + test + deny + audit
just fmt | just lint | just test | just deny | just proto
just migrate         # apply migrations/*.sql over Neon SQL-over-HTTP
just mutants <file>  # new mutants must be killed
```

## Layout

```
proto/auth/v1/*.proto              # contracts: user, session, client, claims
crates/auth-core/                  # pure logic: no I/O, no clock, rng passed in
crates/auth-proto/                 # generated types from proto/ (buf)
crates/db/                         # Neon SQL-over-HTTP kernel
crates/auth-db/                    # shared query builders (users, sessions, oauth, ...)
services/auth/                     # auth worker (`auth-worker`)
services/account/                  # account worker (profile, connections, avatars)
services/developer/                # developer worker (service_apps, logos)
services/admin/                    # admin worker (users, services, audit)
apps/auth-web/                     # SvelteKit: sign-in / register / 2FA / device / lite
apps/id-web/                       # SvelteKit: profile, security, connected apps
apps/developer-web/                # SvelteKit: developer console
apps/admin-web/                    # SvelteKit: admin panel
packages/ui/                       # shared frontend: api client, session, i18n, UI kit
```

Library crates hold logic; each worker crate only wires. One domain concept
per file. `lib.rs` is a facade: docs + `mod` + `pub use`, nothing else.

## Services & domains

- One service = one Rust worker + one SvelteKit app on one domain. The SvelteKit
  (adapter-cloudflare) worker serves the app and reaches its Rust worker through
  a **Service Binding** for `/api/*` — no public API host, no extra proxy.
- Each worker owns its `wrangler` config, bindings, and env. Frontends never
  call a worker cross-domain over the public internet.
- `apps/*` are independent SvelteKit projects (Svelte 5 runes, Tailwind v4, bun);
  share frontend code via `packages/ui` (rule of three before extracting).

## Data, sessions, service-to-service

- One Neon database, one Cloudflare account. Inter-worker calls go over
  **Service Bindings** (trusted, in-account), never public HTTP.
- Table ownership is per service: `auth` = `users`(credential/role/status/MFA
  flags), `opaque_records`, `sessions`, `refresh_tokens`, `mfa_codes`,
  `passkeys`, `identities`, `oauth_states`, `device_codes`; `account` =
  profile fields + `authorized_connections` + avatar R2 keys; `developer` =
  `service_apps`; `admin` = `audit_log` + read-only aggregation. A service
  reads/writes only its tables; others go through its API/binding.
- Sessions: access/refresh cookies scoped to `.neome.uk`, so every frontend
  sees the same session. Workers verify access tokens locally against
  `auth`'s public **JWKS** (cached) — no per-request call to `auth`.
- Avatars: R2 bucket + CDN, owned by `account`; key = sha256, `prevAvatarKey`
  refcount on replace. `users.avatar` holds the CDN URL.
- Schema changes: `migrations/*.sql` applied by `just migrate` over Neon
  SQL-over-HTTP (`_migrations` ledger, idempotent), tagged with the owning
  service. Prisma is not the source of truth.

## Models live in proto/

- Every persisted / wire / storage shape is a `proto/auth/v1/*.proto`
  message; Rust consumes the generated `auth-proto` types. No hand-written
  mirror models, no duplicated field lists.
- JSON wire names that must match external contracts (JWT reserved claims,
  previous-service parity) are pinned in `auth-proto/build.rs` via
  `field_attribute` renames — never by renaming proto fields.
- Hand-written types allowed only for: security newtypes (invariants the
  type system enforces: `Envelope`, `SessionKey`), control-flow outcome
  enums, partial-row projections (never default-fill unloaded fields),
  redacting wrappers around secrets.
- New shape? Add the message to proto first, regenerate, then use it.

## Workflow

- Goal + non-goals + testable acceptance criteria before code. Smallest
  vertical slice first. Read the files you will touch before editing.
- Diff < 300 LOC, one behavior per change. Reproduce-first for bugfixes
  (failing test before fix). Verify by execution, never by reasoning:
  paste command + output as evidence.
- Commits: short imperative names (<72 chars), e.g. `auth-core: add OPAQUE`.
  No essays in messages. Commit only on owner request.
- Rule of three: no new abstraction without 3 uses. No new file for <50
  lines of shared logic. No new dependency without justification in the
  change (audit status, MSRV fit, wasm32 build, maintenance signs).
- wasm32 closure stays native-free: crates in the worker build use
  `default-features = false` on workspace deps; non-portable code
  (webauthn/openssl) behind opt-in features. Verify every worker crate, e.g.
  `cargo check -p auth-worker -p account-worker --target wasm32-unknown-unknown`.
- Ubiquitous language, no synonyms: OP (our server), RP (external app),
  envelope (OPAQUE server record — never "hash"), OPRF key (service secret),
  KSF (client Argon2id), kid, re-enrollment (bcrypt → OPAQUE via email
  code), shadow run, cutover, lite (no-JS, email-code only).

## Anti-slop (applies to every change, no exceptions)

- No WHAT comments, ever. Module `//!` preambles restating the filename,
  `///` paraphrasing the signature, `//` narrating the next line, section
  dividers, commented-out code: delete on sight.
- Deletion test for every comment: remove it; if the code reads ambiguous,
  rename, split, add a type, or write a test — do not re-add the prose.
- WHY only when it cannot be encoded in types, tests, or lint: non-obvious
  external behavior, negative information (what was deliberately not done),
  security rationale. Prefer encoding: regression test named after the
  rationale, `reason = "..."` on allows, failing-check in CI over prose.
- No single-use named constants (inline the value); no helper called once
  (inline it); no wrapper forwarding without adding logic; no defensive
  check the types already guarantee (validate at system boundaries only).
- No tautological tests: assert properties and cross-boundary behavior,
  never mirror the implementation's branches. Test names carry intent.
  Exception: fixed mapping tables at trust boundaries (e.g. lib error →
  coarse error) are pinned by table tests — the table is the contract.

## Rust (API Guidelines + Ousterhout, enforced in review)

- Naming: `UpperCamelCase` types, `snake_case` fns, `as_` = cheap borrow,
  `to_` = expensive copy, `into_` = owned conversion. Getters without `get_`
  (`len()`, not `get_len()`). Conversions via `From`/`AsRef`, not `from_x`.
- No `bool`/`Option` parameters — enums, config structs, or builders.
  No `&String`/`&Vec`/`&PathBuf` args — `&str`/`&[T]`/`&Path`. Newtypes for
  domain values (`UserId(String)`), private field + constructor validating once
  ("parse, don't validate").
- Default `pub(crate)`; `pub` needs a reason. No `pub mod everything`,
  no wildcard imports in lib code, no `pub(super)`. Bounds on `impl`, never
  on struct definitions. `#[must_use]` on pure value-returning fns,
  `#[non_exhaustive]` on public evolving enums.
- Errors: one `thiserror` enum per concern, named `<Concern>Error`,
  `#[source]`/`#[from]`, per-variant messages, no `String` errors, no
  `Box<dyn Error>` across modules. `Result` = recoverable, `Option` =
  normal absence, panic = bug only, never control flow. Name every variant
  in `match` on security enums (payload `_` only for uninhabited/opaque
  payloads); a lib upgrade adding a variant must fail compilation. External
  `#[non_exhaustive]` enums: name all known variants, wildcard arm →
  `Internal` (fail-closed: unknown future errors alert instead of passing).
- Deep modules: one `pub fn` hiding parsing/caching/validation beats 8
  shallow helpers. Split for abstraction, not line count. Iterator pipelines
  over nested loops. `enum` dispatch over `Box<dyn Trait>` (trait objects
  only for open extension sets).
- No WHAT docs. One summary line only when the name does not carry it.
  WHY only if unencodable in types/tests. `missing_errors_doc` stays allowed
  crate-wide with `reason` (the error enum is the single source).
  `Debug` on all public types except secrets (redacted + test).

## CI gates (all green, no exceptions)

1. `cargo fmt --check` (width 100) + `clippy --all-targets -D warnings
   -W clippy::pedantic`.
2. `cargo deny check` + `cargo audit`; `Cargo.lock` committed; MIT/Apache-2.0 only.
3. `cargo test --workspace` passes.
4. `cargo mutants -f <changed>`: kill all new mutants (stronger than coverage).
5. Fuzz target for every byte/network input; corpus in repo.
6. RFC test vectors byte-for-byte; OIDF suite (Basic + Config + Dynamic) is
   the service DoD.

## Forbid list (hard)

- `unwrap()` / `expect()` / `panic!` / indexing / `todo!` / `dbg!` in `src/`
  production code (`tests/` and `#[cfg(test)]` exempt). `?`, `let-else`,
  `map_or`, `unwrap_or*` (total, never panicking) instead.
- `unsafe` (workspace-deny). `#[allow]` only with `reason = "..."`.
- weakened assertions, deleted failing tests, or silenced lints to get green.
- custom crypto: audited high-level crates only, never hand-rolled primitives.
- `println!` in library code; secrets in logs, errors, or traces
  (`#[instrument(skip(secret))]`).
- network in tests; hand-edited lockfiles/generated code; commented-out code;
  TODO without owner approval.
- commits without `fmt + lint + test`. No prod deploys, no `--force` pushes.
