use auth_core::{
    CredentialId, OpaqueSetup, login_finalize, login_finish, login_request, login_response,
    register_request, register_response, register_store, register_upload,
};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

#[test]
fn client_wrappers_complete_handshake() {
    let setup = OpaqueSetup::generate(&mut ChaCha8Rng::seed_from_u64(1));
    let mut rng = ChaCha8Rng::seed_from_u64(2);
    let id = b"u1";
    let credential = CredentialId::try_from(id.as_slice()).unwrap();
    let (request, reg_state) = register_request(&mut rng, b"pw").unwrap();
    let response = register_response(&setup, &request, credential).unwrap();
    let upload = register_upload(reg_state, &mut rng, b"pw", &response).unwrap();
    let envelope = register_store(&upload).unwrap();
    let (login_req, login_state) = login_request(&mut rng, b"pw").unwrap();
    let (login_resp, server_state) =
        login_response(&setup, &envelope, &login_req, credential, &mut rng).unwrap();
    let (finalization, client_key) =
        login_finalize(login_state, &mut rng, b"pw", &login_resp).unwrap();
    let server_key = login_finish(server_state, &finalization).unwrap();
    assert_eq!(client_key, server_key.expose());
}
