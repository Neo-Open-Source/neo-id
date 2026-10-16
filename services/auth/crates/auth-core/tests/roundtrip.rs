use auth_core::{
    AuthError, CredentialId, Envelope, NeoSuite, OpaqueSetup, SessionKey, login_finish,
    login_response, register_response, register_store,
};
use opaque_ke::{
    ClientLogin, ClientLoginFinishParameters, ClientRegistration,
    ClientRegistrationFinishParameters, CredentialResponse, RegistrationResponse,
};
use rand::{CryptoRng, RngCore, SeedableRng};
use rand_chacha::ChaCha8Rng;

fn seeded_setup() -> OpaqueSetup {
    OpaqueSetup::generate(&mut ChaCha8Rng::seed_from_u64(7))
}

fn enroll<R: RngCore + CryptoRng>(
    setup: &OpaqueSetup,
    rng: &mut R,
    id: &[u8],
    password: &[u8],
) -> Envelope {
    let id = CredentialId::try_from(id).unwrap();
    let start = ClientRegistration::<NeoSuite>::start(rng, password).unwrap();
    let response = register_response(setup, &start.message.serialize(), id).unwrap();
    let finish = start
        .state
        .finish(
            rng,
            password,
            RegistrationResponse::deserialize(&response).unwrap(),
            ClientRegistrationFinishParameters::default(),
        )
        .unwrap();
    register_store(&finish.message.serialize()).unwrap()
}

fn login<R: RngCore + CryptoRng>(
    setup: &OpaqueSetup,
    envelope: &Envelope,
    rng: &mut R,
    id: &[u8],
    password: &[u8],
) -> (Vec<u8>, SessionKey, Vec<u8>) {
    let id = CredentialId::try_from(id).unwrap();
    let start = ClientLogin::<NeoSuite>::start(rng, password).unwrap();
    let (response_bytes, state) =
        login_response(setup, envelope, &start.message.serialize(), id, rng).unwrap();
    let finish = start
        .state
        .finish(
            rng,
            password,
            CredentialResponse::deserialize(&response_bytes).unwrap(),
            ClientLoginFinishParameters::default(),
        )
        .unwrap();
    let final_bytes = finish.message.serialize().to_vec();
    let session = login_finish(state, &final_bytes).unwrap();
    (finish.session_key.to_vec(), session, final_bytes)
}

#[test]
fn matching_session_keys_after_register_then_login() {
    let setup = seeded_setup();
    let envelope = enroll(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    let (client_key, server_key, _) = login(
        &setup,
        &envelope,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    assert_eq!(client_key, server_key.expose());
}

#[test]
fn debug_redacts_session_key() {
    let setup = seeded_setup();
    let envelope = enroll(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    let (_, server_key, _) = login(
        &setup,
        &envelope,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    assert_eq!(format!("{server_key:?}"), "SessionKey(REDACTED)");
}

#[test]
fn wrong_password_fails_client_side() {
    let setup = seeded_setup();
    let envelope = enroll(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    let id = CredentialId::try_from(b"alice".as_slice()).unwrap();
    let start =
        ClientLogin::<NeoSuite>::start(&mut ChaCha8Rng::seed_from_u64(1), b"wrong horse").unwrap();
    let (response_bytes, _) = login_response(
        &setup,
        &envelope,
        &start.message.serialize(),
        id,
        &mut ChaCha8Rng::seed_from_u64(1),
    )
    .unwrap();
    assert!(
        start
            .state
            .finish(
                &mut ChaCha8Rng::seed_from_u64(1),
                b"wrong horse",
                CredentialResponse::deserialize(&response_bytes).unwrap(),
                ClientLoginFinishParameters::default(),
            )
            .is_err()
    );
}

#[test]
fn tampered_finalization_is_invalid_credentials() {
    let setup = seeded_setup();
    let envelope = enroll(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    let id = CredentialId::try_from(b"alice".as_slice()).unwrap();
    let start = ClientLogin::<NeoSuite>::start(&mut ChaCha8Rng::seed_from_u64(1), b"correct horse")
        .unwrap();
    let (response_bytes, state) = login_response(
        &setup,
        &envelope,
        &start.message.serialize(),
        id,
        &mut ChaCha8Rng::seed_from_u64(1),
    )
    .unwrap();
    let finish = start
        .state
        .finish(
            &mut ChaCha8Rng::seed_from_u64(1),
            b"correct horse",
            CredentialResponse::deserialize(&response_bytes).unwrap(),
            ClientLoginFinishParameters::default(),
        )
        .unwrap();
    let mut final_bytes = finish.message.serialize().to_vec();
    if let Some(byte) = final_bytes.get_mut(5) {
        *byte ^= 1;
    }
    assert!(matches!(
        login_finish(state, &final_bytes),
        Err(AuthError::InvalidCredentials)
    ));
}

#[test]
fn wrong_length_request_is_malformed() {
    let setup = seeded_setup();
    let id = CredentialId::try_from(b"alice".as_slice()).unwrap();
    for len in [0, 31, 33, 64] {
        assert!(matches!(
            register_response(&setup, &vec![9u8; len], id),
            Err(AuthError::MalformedMessage)
        ));
    }
}

#[test]
fn undecodable_point_is_malformed() {
    let setup = seeded_setup();
    let id = CredentialId::try_from(b"alice".as_slice()).unwrap();
    assert!(matches!(
        register_response(&setup, &[0xffu8; 32], id),
        Err(AuthError::MalformedMessage)
    ));
}

#[test]
fn identity_element_is_malformed() {
    let setup = seeded_setup();
    let id = CredentialId::try_from(b"alice".as_slice()).unwrap();
    assert!(matches!(
        register_response(&setup, &[0u8; 32], id),
        Err(AuthError::MalformedMessage)
    ));
}

#[test]
fn empty_credential_id_rejected() {
    assert!(matches!(
        CredentialId::try_from(b"".as_slice()),
        Err(AuthError::MalformedMessage)
    ));
}

#[test]
fn setup_bytes_roundtrip() {
    let setup = seeded_setup();
    let bytes = setup.to_bytes();
    assert_eq!(
        OpaqueSetup::try_from_bytes(&bytes).unwrap().to_bytes(),
        bytes
    );
}

#[test]
fn trailing_bytes_rejected() {
    let setup = seeded_setup();
    let mut setup_bytes = setup.to_bytes();
    setup_bytes.push(0);
    assert!(matches!(
        OpaqueSetup::try_from_bytes(&setup_bytes),
        Err(AuthError::MalformedMessage)
    ));
    let envelope = enroll(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    let mut envelope_bytes = envelope.as_bytes().to_vec();
    envelope_bytes.push(0);
    assert!(matches!(
        Envelope::try_from_bytes(&envelope_bytes),
        Err(AuthError::MalformedMessage)
    ));
}

#[test]
fn suite_output_lengths_are_pinned() {
    let setup = seeded_setup();
    let envelope = enroll(
        &setup,
        &mut ChaCha8Rng::seed_from_u64(1),
        b"alice",
        b"correct horse",
    );
    assert_eq!(setup.to_bytes().len(), 128);
    assert_eq!(envelope.as_bytes().len(), 192);
}

#[test]
fn seeded_runs_are_byte_identical() {
    let first = seeded_setup();
    let second = seeded_setup();
    assert_eq!(first.to_bytes(), second.to_bytes());
    let first_env = enroll(&first, &mut ChaCha8Rng::seed_from_u64(9), b"alice", b"pw");
    let second_env = enroll(&second, &mut ChaCha8Rng::seed_from_u64(9), b"alice", b"pw");
    assert_eq!(first_env, second_env);
}
