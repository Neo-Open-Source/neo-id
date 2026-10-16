use auth_core::OpaqueSetup;
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use rand::SeedableRng;
use rand_chacha::ChaCha8Rng;
use std::io::Read;

fn main() {
    let mut seed = [0u8; 32];
    std::fs::File::open("/dev/urandom")
        .and_then(|mut file| file.read_exact(&mut seed))
        .expect("os rng unavailable");
    let setup = OpaqueSetup::generate(&mut ChaCha8Rng::from_seed(seed));
    println!("{}", URL_SAFE_NO_PAD.encode(setup.to_bytes()));
}
