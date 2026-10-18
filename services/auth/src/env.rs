use auth_core::{AuthError, KeyRing, OpaqueSetup, SigningAlg, SigningKey, VerifyKey};
use base64::{Engine, engine::general_purpose::URL_SAFE_NO_PAD};
use worker::Env;

pub struct AppEnv {
    pub endpoint: String,
    pub signing: SigningKey,
    pub verify_keys: KeyRing,
    pub rsa_public_pem: Vec<u8>,
    pub es256_public_pem: Option<Vec<u8>>,
    pub setup: OpaqueSetup,
    pub issuer: String,
    pub mail_url: Option<String>,
    pub mail_key: String,
    pub web_origin: String,
    pub turnstile_secret: Option<String>,
    pub altcha_secret: Option<String>,
    pub altcha_fallback: bool,
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

fn non_empty(value: Option<String>) -> Option<String> {
    value.filter(|raw| !raw.is_empty())
}

fn flag(value: Option<&str>) -> bool {
    match value {
        None => true,
        Some(raw) => !matches!(raw.to_lowercase().as_str(), "0" | "false" | "off" | "no"),
    }
}

fn signing_alg(choice: Option<&str>) -> Result<SigningAlg, AuthError> {
    match choice.map(str::to_uppercase).as_deref() {
        None | Some("RS256") => Ok(SigningAlg::Rs256),
        Some("ES256") => Ok(SigningAlg::Es256),
        Some(_) => Err(AuthError::Internal),
    }
}

fn build_signing(
    requested: SigningAlg,
    rsa_private: Vec<u8>,
    es256_private: Option<Vec<u8>>,
) -> Result<SigningKey, AuthError> {
    match requested {
        SigningAlg::Es256 => Ok(SigningKey::new(
            SigningAlg::Es256,
            es256_private.ok_or(AuthError::Internal)?,
        )),
        SigningAlg::Rs256 => Ok(SigningKey::new(SigningAlg::Rs256, rsa_private)),
        _ => Err(AuthError::Internal),
    }
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
    let requested = signing_alg(
        env.var("JWT_SIGNING_ALG")
            .map(|value| value.to_string())
            .ok()
            .as_deref(),
    )?;
    let signing = build_signing(requested, private_pem, es256_private_pem)?;
    let mut keys = vec![VerifyKey::new(SigningAlg::Rs256, rsa_public_pem.clone())];
    if let Some(public) = es256_public_pem.as_deref() {
        keys.push(VerifyKey::new(SigningAlg::Es256, public.to_vec()));
    }
    let verify_keys = KeyRing::new(keys);
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
    let turnstile_secret = non_empty(
        env.secret("TURNSTILE_SECRET")
            .map(|secret| secret.to_string())
            .ok(),
    );
    let altcha_secret = non_empty(
        env.secret("ALTCHA_SECRET")
            .map(|secret| secret.to_string())
            .ok(),
    );
    let altcha_fallback = flag(
        env.var("CAPTCHA_ALTCHA_FALLBACK")
            .map(|value| value.to_string())
            .ok()
            .as_deref(),
    );
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
        verify_keys,
        rsa_public_pem,
        es256_public_pem,
        setup: OpaqueSetup::try_from_bytes(&setup_raw)?,
        issuer,
        mail_url,
        mail_key,
        web_origin,
        turnstile_secret,
        altcha_secret,
        altcha_fallback,
        #[cfg(feature = "passkeys")]
        rp_id,
        #[cfg(feature = "passkeys")]
        rp_origin,
    })
}

#[cfg(test)]
mod tests {
    use super::{build_signing, flag, non_empty, signing_alg, unescape_pem};
    use auth_core::SigningAlg;

    #[test]
    fn empty_secret_is_treated_as_absent() {
        assert_eq!(non_empty(Some(String::new())), None);
        assert_eq!(non_empty(None), None);
        assert_eq!(non_empty(Some("x".to_string())), Some("x".to_string()));
    }

    #[test]
    fn fallback_flag_defaults_on_and_parses_off() {
        assert!(flag(None));
        assert!(flag(Some("true")));
        assert!(flag(Some("altcha")));
        assert!(!flag(Some("0")));
        assert!(!flag(Some("false")));
        assert!(!flag(Some("OFF")));
        assert!(!flag(Some("no")));
    }

    #[test]
    fn unescape_pem_replaces_literal_newlines() {
        assert_eq!(unescape_pem("a\\nb"), b"a\nb".to_vec());
        assert_eq!(unescape_pem("plain"), b"plain".to_vec());
    }

    #[test]
    fn signing_alg_defaults_rs256_and_fails_closed() {
        assert_eq!(signing_alg(None).unwrap(), SigningAlg::Rs256);
        assert_eq!(signing_alg(Some("rs256")).unwrap(), SigningAlg::Rs256);
        assert_eq!(signing_alg(Some("ES256")).unwrap(), SigningAlg::Es256);
        assert!(signing_alg(Some("")).is_err());
        assert!(signing_alg(Some("HS256")).is_err());
    }

    #[test]
    fn build_signing_selects_requested_key_or_fails() {
        let rsa = build_signing(SigningAlg::Rs256, b"rsa".to_vec(), Some(b"ec".to_vec())).unwrap();
        assert_eq!(rsa.alg(), SigningAlg::Rs256);
        let ec = build_signing(SigningAlg::Es256, b"rsa".to_vec(), Some(b"ec".to_vec())).unwrap();
        assert_eq!(ec.alg(), SigningAlg::Es256);
        assert!(build_signing(SigningAlg::Es256, b"rsa".to_vec(), None).is_err());
    }
}
