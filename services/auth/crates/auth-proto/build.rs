fn main() {
    let root = "../../../../proto";
    let mut config = prost_build::Config::new();
    config.type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]");
    for (field, name) in [
        ("auth.v1.AccessClaims.session_id", "session_id"),
        ("auth.v1.AccessClaims.iat_unix", "iat"),
        ("auth.v1.AccessClaims.exp_unix", "exp"),
        ("auth.v1.IDTokenClaims.iat_unix", "iat"),
        ("auth.v1.IDTokenClaims.exp_unix", "exp"),
    ] {
        config.field_attribute(field, format!("#[serde(rename = \"{name}\")]"));
    }
    for field in [
        "auth.v1.AccessClaims.session_id",
        "auth.v1.IDTokenClaims.aud",
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
            ]
            .map(|name| format!("{root}/{name}")),
            &[root],
        )
        .unwrap();
}
