mod common;

use auth_accounts::{
    CodeOutcome, ForgotOutcome, change_email_confirm, change_email_request, confirm_email,
    forgot_password, request_email_code, reset_password, totp_begin, totp_disable, totp_enable,
    verify_email_code,
};
use common::{Scripted, run, user_row};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

fn code_row() -> serde_json::Value {
    serde_json::json!({"id": "c1", "code": "123456", "createdAt": 1000})
}

#[test]
fn email_code_request_verify_cooldown() {
    let first = Scripted::feed(vec![vec![], vec![], vec![]]);
    let sent = run(request_email_code(
        &first,
        &mut ChaCha8Rng::seed_from_u64(1),
        "u1",
        "mfa_login",
        None,
        1000,
    ))
    .unwrap();
    assert!(matches!(sent, CodeOutcome::Sent(_)));

    let cooling = Scripted::feed(vec![vec![code_row()]]);
    let outcome = run(request_email_code(
        &cooling,
        &mut ChaCha8Rng::seed_from_u64(1),
        "u1",
        "mfa_login",
        None,
        1010,
    ))
    .unwrap();
    assert!(matches!(outcome, CodeOutcome::Cooldown(50)));

    let boundary = Scripted::feed(vec![
        vec![serde_json::json!({"id": "c0", "code": "000000", "createdAt": 940})],
        vec![],
        vec![],
    ]);
    let sent = run(request_email_code(
        &boundary,
        &mut ChaCha8Rng::seed_from_u64(1),
        "u1",
        "mfa_login",
        None,
        1000,
    ))
    .unwrap();
    assert!(matches!(sent, CodeOutcome::Sent(_)));
    assert_eq!(
        boundary.param("INSERT INTO \"mfa_codes\"", 4),
        Some(serde_json::json!(1600))
    );

    let good = Scripted::feed(vec![vec![code_row()], vec![]]);
    assert!(run(verify_email_code(&good, "u1", "mfa_login", "123456", 1100)).unwrap());

    let bad = Scripted::feed(vec![vec![code_row()]]);
    assert!(!run(verify_email_code(&bad, "u1", "mfa_login", "000000", 1100)).unwrap());

    let none = Scripted::feed(vec![vec![]]);
    assert!(!run(verify_email_code(&none, "u1", "mfa_login", "123456", 1100)).unwrap());
}

#[test]
fn totp_lifecycle() {
    let setup = Scripted::feed(vec![vec![]]);
    let created = run(totp_begin(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        "u1",
        "a@b.c",
    ))
    .unwrap();
    assert!(created.uri.starts_with("otpauth://totp/"));

    let secret_row = || vec![serde_json::json!({"totpSecret": created.secret.clone()})];
    let enable = Scripted::feed(vec![secret_row(), vec![]]);
    assert!(!run(totp_enable(&enable, "u1", "000000", 1_800_000_000)).unwrap());

    let rfc_row = || vec![serde_json::json!({"totpSecret": "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ"})];
    let enable_ok = Scripted::feed(vec![rfc_row(), vec![]]);
    assert!(run(totp_enable(&enable_ok, "u1", "287082", 59)).unwrap());
    assert!(enable_ok.ran("UPDATE \"users\""));

    let disable = Scripted::feed(vec![secret_row()]);
    assert!(!run(totp_disable(&disable, "u1", "000000", 1_800_000_000)).unwrap());
    let disable_ok = Scripted::feed(vec![rfc_row(), vec![]]);
    assert!(run(totp_disable(&disable_ok, "u1", "287082", 59)).unwrap());
}

#[test]
fn password_reset_flow() {
    let unknown = Scripted::feed(vec![vec![]]);
    assert!(matches!(
        run(forgot_password(
            &unknown,
            &mut ChaCha8Rng::seed_from_u64(1),
            "ghost@x.y",
            1000
        ))
        .unwrap(),
        ForgotOutcome::Unknown
    ));

    let known = Scripted::feed(vec![vec![user_row()], vec![]]);
    let outcome = run(forgot_password(
        &known,
        &mut ChaCha8Rng::seed_from_u64(1),
        "a@b.c",
        1000,
    ))
    .unwrap();
    assert!(matches!(outcome, ForgotOutcome::Emailed(_)));
    assert_eq!(
        known.param("userMetadata", 2),
        Some(serde_json::json!(4600))
    );

    let valid = Scripted::feed(vec![vec![user_row()], vec![]]);
    assert_eq!(
        run(reset_password(&valid, "ticket", 1000)).unwrap(),
        Some("u1".to_string())
    );
    let invalid = Scripted::feed(vec![vec![]]);
    assert_eq!(run(reset_password(&invalid, "ticket", 1000)).unwrap(), None);
}

#[test]
fn change_email_flow() {
    let requested = Scripted::feed(vec![vec![], vec![], vec![]]);
    assert!(matches!(
        run(change_email_request(
            &requested,
            &mut ChaCha8Rng::seed_from_u64(1),
            "u1",
            1000
        ))
        .unwrap(),
        CodeOutcome::Sent(_)
    ));
    let confirmed = Scripted::feed(vec![vec![code_row()], vec![], vec![]]);
    assert!(
        run(change_email_confirm(
            &confirmed, "u1", "n@x.y", "123456", 1100
        ))
        .unwrap()
    );
    assert!(confirmed.ran("UPDATE \"users\""));

    let verified = Scripted::feed(vec![vec![code_row()], vec![], vec![]]);
    assert!(run(confirm_email(&verified, "u1", "123456", 1100)).unwrap());
    assert!(verified.ran("UPDATE \"users\""));
}
