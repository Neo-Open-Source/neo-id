#![cfg(feature = "webauthn")]

use auth_core::{
    AuthError, AuthenticationState, PasskeyRp, RegistrationState, StoredCredential,
    authentication_options, registration_options, user_uuid, verify_authentication,
    verify_registration,
};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use sha2::{Digest, Sha256};
use webauthn_authenticator_rs::AuthenticatorBackendHashedClientData;
use webauthn_authenticator_rs::prelude::{Url, WebauthnAuthenticator};
use webauthn_authenticator_rs::softpasskey::SoftPasskey;
use webauthn_rs::prelude::Uuid;
use webauthn_rs_core::error::WebauthnError;

const RP_ID: &str = "id.neome.uk";
const ORIGIN: &str = "https://id.neome.uk";
const CAPTURED_TOKEN_COSE_ES256: [u8; 77] = [
    165, 1, 2, 3, 38, 32, 1, 33, 88, 32, 79, 120, 96, 38, 152, 72, 174, 160, 13, 220, 173, 53, 215,
    173, 221, 92, 245, 218, 56, 26, 82, 221, 115, 46, 254, 214, 240, 101, 160, 128, 143, 242, 34,
    88, 32, 231, 197, 238, 104, 240, 194, 89, 69, 43, 105, 174, 88, 245, 150, 235, 155, 40, 96,
    186, 201, 63, 163, 59, 168, 165, 26, 192, 122, 251, 192, 152, 66,
];
fn rp() -> PasskeyRp {
    PasskeyRp::new(RP_ID, ORIGIN).unwrap()
}

fn origin() -> Url {
    Url::parse(ORIGIN).unwrap()
}

fn captured_cose_key() -> Vec<u8> {
    CAPTURED_TOKEN_COSE_ES256.to_vec()
}

fn fixed_credential(counter: u32) -> StoredCredential {
    StoredCredential {
        id: vec![7; 32],
        key: captured_cose_key(),
        counter,
        transports: vec!["usb".to_string(), "bogus".to_string()],
        backup_eligible: false,
        backup_state: false,
    }
}

fn register_token(rp: &PasskeyRp) -> (StoredCredential, WebauthnAuthenticator<SoftPasskey>) {
    let (options, state) =
        registration_options(rp, Uuid::new_v4(), "alice@example.com", &[]).unwrap();
    let mut token = WebauthnAuthenticator::new(SoftPasskey::new(true));
    let response = token.do_registration(origin(), options).unwrap();
    let stored =
        verify_registration(rp, &serde_json::to_string(&response).unwrap(), &state).unwrap();
    (stored, token)
}

#[test]
fn rp_rejects_unusable_config() {
    assert_eq!(
        PasskeyRp::new(RP_ID, "not a url %%").unwrap_err(),
        AuthError::Internal
    );
    assert_eq!(
        PasskeyRp::new("other.example", ORIGIN).unwrap_err(),
        AuthError::Internal
    );
}

#[test]
fn registration_options_carry_rp_challenge_and_user() {
    let rp = rp();
    let user = Uuid::new_v4();
    let (first, _) = registration_options(&rp, user, "alice@example.com", &[]).unwrap();
    let (second, _) = registration_options(&rp, user, "alice@example.com", &[]).unwrap();
    let first = serde_json::to_value(&first).unwrap();
    let second = serde_json::to_value(&second).unwrap();

    assert_eq!(first["publicKey"]["rp"]["id"], RP_ID);
    assert_eq!(first["publicKey"]["rp"]["name"], "Neo ID");
    assert_eq!(first["publicKey"]["attestation"], "none");
    assert_eq!(first["publicKey"]["user"]["name"], "alice@example.com");
    assert_eq!(
        first["publicKey"]["user"]["id"],
        URL_SAFE_NO_PAD.encode(user.as_bytes())
    );
    assert_eq!(
        first["publicKey"]["authenticatorSelection"]["userVerification"],
        "required"
    );
    assert_ne!(
        first["publicKey"]["challenge"],
        second["publicKey"]["challenge"]
    );
}

#[test]
fn registration_options_exclude_existing_credentials() {
    let rp = rp();
    let excluded = fixed_credential(0);
    let (options, _) =
        registration_options(&rp, Uuid::new_v4(), "alice@example.com", &[excluded]).unwrap();
    let options = serde_json::to_value(&options).unwrap();
    assert_eq!(
        options["publicKey"]["excludeCredentials"][0]["id"],
        URL_SAFE_NO_PAD.encode([7; 32])
    );
    assert_eq!(
        options["publicKey"]["excludeCredentials"][0]["type"],
        "public-key"
    );
}

#[test]
fn full_ceremony_roundtrip_advances_counter() {
    let rp = rp();
    let (options, state) =
        registration_options(&rp, Uuid::new_v4(), "alice@example.com", &[]).unwrap();
    let mut token = WebauthnAuthenticator::new(SoftPasskey::new(true));
    let response = token.do_registration(origin(), options).unwrap();
    let stored =
        verify_registration(&rp, &serde_json::to_string(&response).unwrap(), &state).unwrap();
    assert_ne!(stored.id.len(), 0);
    assert_ne!(stored.key.len(), 0);
    assert_eq!(stored.counter, 0);

    let (auth_options, auth_state) =
        authentication_options(&rp, std::slice::from_ref(&stored)).unwrap();
    let auth_options_json = serde_json::to_value(&auth_options).unwrap();
    assert_eq!(
        auth_options_json["publicKey"]["allowCredentials"][0]["id"],
        URL_SAFE_NO_PAD.encode(&stored.id)
    );
    let assertion = token.do_authentication(origin(), auth_options).unwrap();
    let verified = verify_authentication(
        &rp,
        &serde_json::to_string(&assertion).unwrap(),
        &auth_state,
    )
    .unwrap();
    assert_eq!(verified.credential_id, stored.id);
    assert_eq!(verified.counter, 1);

    let mut second = stored.clone();
    second.counter = verified.counter;
    let (auth_options, auth_state) = authentication_options(&rp, &[second]).unwrap();
    let assertion = token.do_authentication(origin(), auth_options).unwrap();
    let verified = verify_authentication(
        &rp,
        &serde_json::to_string(&assertion).unwrap(),
        &auth_state,
    )
    .unwrap();
    assert_eq!(verified.counter, 2);
}

#[test]
fn registration_response_bound_to_another_state_fails() {
    let rp = rp();
    let (options, _) = registration_options(&rp, Uuid::new_v4(), "alice@example.com", &[]).unwrap();
    let (_, other_state) =
        registration_options(&rp, Uuid::new_v4(), "alice@example.com", &[]).unwrap();
    let mut token = WebauthnAuthenticator::new(SoftPasskey::new(true));
    let response = token.do_registration(origin(), options).unwrap();
    assert_eq!(
        verify_registration(
            &rp,
            &serde_json::to_string(&response).unwrap(),
            &other_state
        )
        .unwrap_err(),
        AuthError::InvalidCredentials
    );
}

#[test]
fn registration_with_foreign_origin_fails() {
    let rp = rp();
    let (options, state) =
        registration_options(&rp, Uuid::new_v4(), "alice@example.com", &[]).unwrap();
    let challenge = URL_SAFE_NO_PAD.encode(options.public_key.challenge.as_slice());
    let hostile_client_data = serde_json::to_vec(&serde_json::json!({
        "type": "webauthn.create",
        "challenge": challenge,
        "origin": "https://evil.example.com",
    }))
    .unwrap();
    let hostile_hash = Sha256::digest(&hostile_client_data).to_vec();
    let mut token = SoftPasskey::new(true);
    let mut response = token
        .perform_register(hostile_hash, options.public_key.clone(), 60_000)
        .unwrap();
    response.response.client_data_json = hostile_client_data.into();
    assert_eq!(
        verify_registration(&rp, &serde_json::to_string(&response).unwrap(), &state).unwrap_err(),
        AuthError::InvalidCredentials
    );
}

#[test]
fn authentication_rejects_stale_and_equal_counters() {
    let rp = rp();
    let (stored, mut token) = register_token(&rp);

    let (options, state) = authentication_options(&rp, std::slice::from_ref(&stored)).unwrap();
    let assertion = token.do_authentication(origin(), options).unwrap();
    let verified =
        verify_authentication(&rp, &serde_json::to_string(&assertion).unwrap(), &state).unwrap();
    assert_eq!(verified.counter, 1);

    for counter in [2, 9] {
        let mut replayed = stored.clone();
        replayed.counter = counter;
        let (round_options, round_state) = authentication_options(&rp, &[replayed]).unwrap();
        let assertion = token.do_authentication(origin(), round_options).unwrap();
        assert_eq!(
            verify_authentication(
                &rp,
                &serde_json::to_string(&assertion).unwrap(),
                &round_state
            )
            .unwrap_err(),
            AuthError::InvalidCredentials,
            "stored counter {counter}"
        );
    }
}

#[test]
fn stored_key_bytes_survive_decode_for_options() {
    let rp = rp();
    let (options, _) = authentication_options(&rp, &[fixed_credential(0)]).unwrap();
    let options = serde_json::to_value(&options).unwrap();
    assert_eq!(
        options["publicKey"]["allowCredentials"][0]["id"],
        URL_SAFE_NO_PAD.encode([7; 32])
    );
    assert_eq!(
        options["publicKey"]["allowCredentials"][0]["transports"],
        serde_json::json!(["usb"])
    );
    assert_eq!(options["publicKey"]["rpId"], RP_ID);
}

#[test]
fn undecodable_inputs_are_malformed() {
    let rp = rp();
    let (_, state) = registration_options(&rp, Uuid::new_v4(), "alice@example.com", &[]).unwrap();
    assert_eq!(
        verify_registration(&rp, "definitely not json", &state).unwrap_err(),
        AuthError::MalformedMessage
    );

    let (_, auth_state) = authentication_options(&rp, &[fixed_credential(0)]).unwrap();
    assert_eq!(
        verify_authentication(&rp, "{}", &auth_state).unwrap_err(),
        AuthError::MalformedMessage
    );
    assert_eq!(
        authentication_options(&rp, &[]).unwrap_err(),
        AuthError::MalformedMessage
    );

    let mut truncated = fixed_credential(0);
    truncated.key = vec![0xa5, 0x01];
    assert_eq!(
        authentication_options(&rp, &[truncated]).unwrap_err(),
        AuthError::MalformedMessage
    );

    let mut not_cose = fixed_credential(0);
    not_cose.key = vec![0x01];
    assert_eq!(
        authentication_options(&rp, &[not_cose]).unwrap_err(),
        AuthError::MalformedMessage
    );
}

#[test]
fn webauthn_errors_map_to_coarse_auth_errors() {
    let map = AuthError::from;
    assert_eq!(
        map(WebauthnError::MismatchedChallenge),
        AuthError::InvalidCredentials
    );
    assert_eq!(
        map(WebauthnError::InvalidRPOrigin),
        AuthError::InvalidCredentials
    );
    assert_eq!(
        map(WebauthnError::AuthenticationFailure),
        AuthError::InvalidCredentials
    );
    assert_eq!(
        map(WebauthnError::CredentialPossibleCompromise),
        AuthError::InvalidCredentials
    );
    assert_eq!(
        map(WebauthnError::AttestationChainNotTrusted("x".to_string())),
        AuthError::InvalidCredentials
    );
    assert_eq!(
        map(WebauthnError::COSEKeyInvalidAlgorithm),
        AuthError::MalformedMessage
    );
    assert_eq!(map(WebauthnError::Configuration), AuthError::Internal);

    let json = serde_json::from_str::<u8>("bogus").unwrap_err();
    assert_eq!(
        map(WebauthnError::ParseJSONFailure(json)),
        AuthError::MalformedMessage
    );
    let cbor = serde_cbor_2::from_slice::<serde_cbor_2::Value>(&[]).unwrap_err();
    assert_eq!(
        map(WebauthnError::ParseCBORFailure(cbor)),
        AuthError::MalformedMessage
    );
}

#[test]
fn user_uuid_is_deterministic_per_user() {
    assert_eq!(user_uuid("alice"), user_uuid("alice"));
    assert_ne!(user_uuid("alice"), user_uuid("bob"));
}

#[test]
fn registration_state_survives_bytes_roundtrip() {
    let state = registration_options(&rp(), Uuid::new_v4(), "alice@example.com", &[])
        .map(|(_, state)| state)
        .unwrap();
    let bytes = state.to_bytes().unwrap();
    let restored = RegistrationState::from_bytes(&bytes).unwrap();
    assert_eq!(restored.to_bytes().unwrap(), bytes);
    assert!(RegistrationState::from_bytes(b"nope").is_err());
}

#[test]
fn authentication_state_survives_bytes_roundtrip() {
    let credential = StoredCredential {
        id: vec![7; 32],
        key: CAPTURED_TOKEN_COSE_ES256.to_vec(),
        counter: 0,
        transports: vec![],
        backup_eligible: false,
        backup_state: false,
    };
    let state = authentication_options(&rp(), &[credential])
        .map(|(_, state)| state)
        .unwrap();
    let bytes = state.to_bytes().unwrap();
    let restored = AuthenticationState::from_bytes(&bytes).unwrap();
    assert_eq!(restored.to_bytes().unwrap(), bytes);
    assert!(AuthenticationState::from_bytes(b"nope").is_err());
}
