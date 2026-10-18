fn main() {
    let root = "../../proto";
    println!("cargo:rerun-if-changed={root}");
    let mut config = prost_build::Config::new();
    config.type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]");
    for (field, name) in [
        ("auth.v1.AccessClaims.session_id", "session_id"),
        ("auth.v1.AccessClaims.iat_unix", "iat"),
        ("auth.v1.AccessClaims.exp_unix", "exp"),
        ("auth.v1.AccessClaims.auth_time_unix", "auth_time"),
        ("auth.v1.IDTokenClaims.iat_unix", "iat"),
        ("auth.v1.IDTokenClaims.exp_unix", "exp"),
        ("auth.v1.IDTokenClaims.auth_time_unix", "auth_time"),
        ("auth.v1.AltchaParameters.expires_at", "expiresAt"),
        ("auth.v1.AltchaParameters.key_length", "keyLength"),
        ("auth.v1.AltchaParameters.key_prefix", "keyPrefix"),
        ("auth.v1.AltchaParameters.key_signature", "keySignature"),
        ("auth.v1.AltchaParameters.memory_cost", "memoryCost"),
        ("auth.v1.AltchaSolution.derived_key", "derivedKey"),
    ] {
        config.field_attribute(field, format!("#[serde(rename = \"{name}\")]"));
    }
    for field in [
        "auth.v1.AccessClaims.session_id",
        "auth.v1.AccessClaims.auth_time_unix",
        "auth.v1.AccessClaims.scope",
        "auth.v1.IDTokenClaims.nonce",
        "auth.v1.IDTokenClaims.at_hash",
        "auth.v1.IDTokenClaims.auth_time_unix",
        "auth.v1.UserInfo.email",
        "auth.v1.UserInfo.email_verified",
        "auth.v1.UserInfo.name",
        "auth.v1.UserInfo.given_name",
        "auth.v1.UserInfo.family_name",
        "auth.v1.UserInfo.picture",
        "auth.v1.AltchaParameters.expires_at",
        "auth.v1.AltchaParameters.key_signature",
        "auth.v1.AltchaParameters.memory_cost",
        "auth.v1.AltchaParameters.parallelism",
        "auth.v1.AltchaChallenge.signature",
        "auth.v1.AltchaSolution.time",
    ] {
        config.field_attribute(field, "#[serde(skip_serializing_if = \"Option::is_none\")]");
    }
    config
        .compile_protos(
            &[
                "auth/v1/user.proto",
                "auth/v1/session.proto",
                "auth/v1/claims.proto",
                "auth/v1/client.proto",
                "auth/v1/passkey.proto",
                "auth/v1/token.proto",
                "auth/v1/mfa.proto",
                "auth/v1/device.proto",
                "auth/v1/captcha.proto",
            ]
            .map(|name| format!("{root}/{name}")),
            &[root],
        )
        .unwrap();
}
