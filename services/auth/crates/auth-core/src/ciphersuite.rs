use opaque_ke::argon2::Argon2;
use opaque_ke::ciphersuite::CipherSuite;

pub struct NeoSuite;

impl CipherSuite for NeoSuite {
    type OprfCs = opaque_ke::Ristretto255;
    type KeyExchange = opaque_ke::TripleDh<opaque_ke::Ristretto255, sha2::Sha512>;
    type Ksf = Argon2<'static>;
}
