use auth_core::{AuthError, OpaqueSetup, SigningAlg, SigningKey, VerifyKey};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use worker::Env;

pub struct AppEnv {
    pub endpoint: String,
    pub signing: SigningKey,
    pub verify: VerifyKey,
    pub rsa_public_pem: Vec<u8>,
    pub es256_public_pem: Option<Vec<u8>>,
    pub setup: OpaqueSetup,
    pub issuer: String,
    pub mail_url: Option<String>,
    pub mail_key: String,
    pub web_origin: String,
    pub turnstile_secret: Option<String>,
    pub altcha_secret: Option<String>,
    #[cfg(feature = "passkeys")]
    pub rp_id: String,
    #[cfg(feature = "passkeys")]
    pub rp_origin: String,
}

impl AppEnv {
    pub fn jwks(&self) -> Result<Vec<serde_json::Value>, AuthError> {
        let mut keys = vec![auth_core::rs256_jwk(&self.rsa_public_pem)?];
        if let Some(public) = self.es256_public_pem.as_deref() {
            keys.push(auth_core::es256_jwk(public)?);
        }
        Ok(keys)
    }
}

fn unescape_pem(raw: &str) -> Vec<u8> {
    raw.replace("\\n", "\n").into_bytes()
}

fn secret_pem(env: &Env, name: &str) -> Option<Vec<u8>> {
    env.secret(name)
        .ok()
        .map(|value| unescape_pem(&value.to_string()))
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
    let rsa_public_pem = unescape_pem(
        &env.secret("JWT_PUBLIC_KEY")
            .map_err(|_| AuthError::Internal)?
            .to_string(),
    );
    let es256_private_pem = secret_pem(env, "JWT_ES256_PRIVATE_KEY");
    let es256_public_pem = secret_pem(env, "JWT_ES256_PUBLIC_KEY");
    let (signing, verify) = match (es256_private_pem, es256_public_pem.as_deref()) {
        (Some(private), Some(public)) => (
            SigningKey::new(SigningAlg::Es256, private),
            VerifyKey::new(SigningAlg::Es256, public.to_vec()),
        ),
        _ => (
            SigningKey::new(SigningAlg::Rs256, private_pem),
            VerifyKey::new(SigningAlg::Rs256, rsa_public_pem.clone()),
        ),
    };
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
    let mail_url = env.var("MAIL_API_URL").map(|value| value.to_string()).ok();
    let mail_key = env
        .secret("MAIL_API_KEY")
        .map(|secret| secret.to_string())
        .unwrap_or_default();
    let web_origin = env
        .var("WEB_ORIGIN")
        .map_or("https://id.neome.uk".to_string(), |value| value.to_string());
    let turnstile_secret = env
        .secret("TURNSTILE_SECRET")
        .map(|secret| secret.to_string())
        .ok();
    let altcha_secret = env
        .secret("ALTCHA_SECRET")
        .map(|secret| secret.to_string())
        .ok();
    #[cfg(feature = "passkeys")]
    let rp_id = env
        .var("RP_ID")
        .map_or("id.neome.uk".to_string(), |value| value.to_string());
    #[cfg(feature = "passkeys")]
    let rp_origin = env
        .var("RP_ORIGIN")
        .map_or("https://id.neome.uk".to_string(), |value| value.to_string());
    Ok(AppEnv {
        endpoint,
        signing,
        verify,
        rsa_public_pem,
        es256_public_pem,
        setup: OpaqueSetup::try_from_bytes(&setup_raw)?,
        issuer,
        mail_url,
        mail_key,
        web_origin,
        turnstile_secret,
        altcha_secret,
        #[cfg(feature = "passkeys")]
        rp_id,
        #[cfg(feature = "passkeys")]
        rp_origin,
    })
}

#[cfg(test)]
mod tests {
    use super::unescape_pem;

    #[test]
    fn unescape_pem_replaces_literal_newlines() {
        assert_eq!(unescape_pem("a\\nb"), b"a\nb".to_vec());
        assert_eq!(unescape_pem("plain"), b"plain".to_vec());
    }
}
