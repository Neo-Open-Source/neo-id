use auth_core::{AuthError, CredentialId, OpaqueSetup, register_response, register_store};
use proptest::prelude::*;
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;

proptest! {
    #[test]
    fn garbage_input_is_never_internal_error(request: Vec<u8>, upload: Vec<u8>) {
        let setup = OpaqueSetup::generate(&mut ChaCha8Rng::seed_from_u64(3));
        let id = CredentialId::try_from(b"user".as_slice()).unwrap();
        for result in [
            register_response(&setup, &request, id).map(|_| ()),
            register_store(&upload).map(|_| ()),
        ] {
            prop_assert!(!matches!(result, Err(AuthError::Internal)));
        }
    }
}
