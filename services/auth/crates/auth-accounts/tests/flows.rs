mod common;

use auth_accounts::{
    Availability, Failure, LoginUser, MintParams, check_email, complete_login, end_all_sessions,
    end_session, rotate_refresh, start_login,
};
use auth_core::{AuthError, OpaqueSetup};
use common::{Scripted, refresh_row, run, session_row, user_row};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

const PRIVATE_PEM: &str = include_str!("../../auth-core/tests/data/test-rsa.pem");

fn params() -> MintParams<'static> {
    MintParams {
        private_pem: PRIVATE_PEM.as_bytes(),
        issuer: "https://id.neome.uk",
        device: None,
        ip: None,
        audience: None,
    }
}

#[test]
fn register_availability_branches() {
    let fresh = Scripted::feed(vec![vec![]]);
    assert!(matches!(
        run(check_email(&fresh, "a@b.c")),
        Ok(Availability::Fresh)
    ));
    let resume = Scripted::feed(vec![vec![user_row()], vec![]]);
    assert!(matches!(
        run(check_email(&resume, "a@b.c")),
        Ok(Availability::Resume(_))
    ));
    let taken = Scripted::feed(vec![
        vec![user_row()],
        vec![serde_json::json!({"envelope": "abc"})],
    ]);
    assert!(matches!(
        run(check_email(&taken, "a@b.c")),
        Ok(Availability::Taken)
    ));
}

#[test]
fn login_unknown_user_is_invalid_credentials() {
    let db = Scripted::feed(vec![vec![]]);
    let setup = OpaqueSetup::generate(&mut ChaCha8Rng::seed_from_u64(9));
    assert!(matches!(
        run(start_login(
            &db,
            &setup,
            &mut ChaCha8Rng::seed_from_u64(9),
            "ghost@x.y",
            b"req"
        )),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn complete_login_mints_tokens() {
    let db = Scripted::feed(vec![vec![serde_json::json!({"id": "s1"})], vec![], vec![]]);
    let user = LoginUser {
        id: "u1".to_string(),
        email: "a@b.c".to_string(),
        role: "user".to_string(),
    };
    let minted = run(complete_login(
        &db,
        &mut ChaCha8Rng::seed_from_u64(1),
        1000,
        &params(),
        &user,
    ))
    .unwrap();
    assert_eq!(minted.session_id, "s1");
    assert_eq!(minted.access_token.split('.').count(), 3);
}

#[test]
fn rotate_happy_path_and_revoked() {
    let db = Scripted::feed(vec![
        vec![refresh_row()],
        vec![session_row()],
        vec![],
        vec![],
        vec![user_row()],
        vec![],
        vec![],
    ]);
    let rotation = run(rotate_refresh(
        &db,
        &mut ChaCha8Rng::seed_from_u64(1),
        1000,
        &params(),
        "raw-token",
    ))
    .unwrap();
    assert_eq!(rotation.minted.session_id, "s1");
    assert_eq!(rotation.user.id, "u1");

    let revoked = Scripted::feed(vec![vec![serde_json::json!({
        "id": "r1", "userId": "u1", "sessionId": "s1",
        "expiresAt": 2000, "revokedAt": 900, "revokeReason": "logout",
        "status": "active",
    })]]);
    assert!(matches!(
        run(rotate_refresh(
            &revoked,
            &mut ChaCha8Rng::seed_from_u64(1),
            1000,
            &params(),
            "raw-token",
        )),
        Err(Failure::Code("TOKEN_INVALID"))
    ));
}

#[test]
fn register_finish_stores_envelope() {
    use auth_core::{CredentialId, OpaqueSetup, register_response};
    use opaque_ke::{ClientRegistration, ClientRegistrationFinishParameters, RegistrationResponse};
    let setup = OpaqueSetup::generate(&mut ChaCha8Rng::seed_from_u64(1));
    let mut rng = ChaCha8Rng::seed_from_u64(2);
    let start = ClientRegistration::<auth_core::NeoSuite>::start(&mut rng, b"pw").unwrap();
    let response = register_response(
        &setup,
        &start.message.serialize(),
        CredentialId::try_from(b"u1".as_slice()).unwrap(),
    )
    .unwrap();
    let finish = start
        .state
        .finish(
            &mut rng,
            b"pw",
            RegistrationResponse::deserialize(&response).unwrap(),
            ClientRegistrationFinishParameters::default(),
        )
        .unwrap();
    let db = Scripted::feed(vec![vec![]]);
    run(auth_accounts::finish_registration(
        &db,
        "u1",
        &finish.message.serialize(),
    ))
    .unwrap();
    assert!(db.ran("opaque_records"));
}

#[test]
fn logout_deactivates() {
    let db = Scripted::feed(vec![vec![], vec![]]);
    run(end_session(&db, "s1", 1000)).unwrap();
    assert!(db.ran("UPDATE \"sessions\""));
    let db = Scripted::feed(vec![vec![], vec![]]);
    run(end_all_sessions(&db, "u1", 1000)).unwrap();
    assert!(db.ran("refresh_tokens"));
}
