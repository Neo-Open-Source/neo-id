use auth_core::{AuthError, OpaqueSetup};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use worker::Env;

pub struct AppEnv {
    pub endpoint: String,
    pub private_pem: Vec<u8>,
    pub public_pem: Vec<u8>,
    pub setup: OpaqueSetup,
    pub issuer: String,
}

fn unescape_pem(raw: &str) -> Vec<u8> {
    raw.replace("\\n", "\n").into_bytes()
}

pub fn load(env: &Env) -> Result<AppEnv, AuthError> {
    let database_url = env
        .var("DATABASE_URL")
        .map_err(|_| AuthError::Internal)?
        .to_string();
    let endpoint = auth_db::http_endpoint(&database_url)?;
    let private_pem = unescape_pem(
        &env.secret("JWT_PRIVATE_KEY")
            .map_err(|_| AuthError::Internal)?
            .to_string(),
    );
    let public_pem = unescape_pem(
        &env.secret("JWT_PUBLIC_KEY")
            .map_err(|_| AuthError::Internal)?
            .to_string(),
    );
    let setup_raw = URL_SAFE_NO_PAD
        .decode(
            env.secret("OPRF_SETUP")
                .map_err(|_| AuthError::Internal)?
                .to_string()
                .as_bytes(),
        )
        .map_err(|_| AuthError::Internal)?;
    let issuer = env
        .var("JWT_ISSUER")
        .map_or("https://id.neome.uk".to_string(), |value| value.to_string());
    Ok(AppEnv {
        endpoint,
        private_pem,
        public_pem,
        setup: OpaqueSetup::try_from_bytes(&setup_raw)?,
        issuer,
    })
}
