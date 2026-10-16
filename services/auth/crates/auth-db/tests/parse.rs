use auth_db::*;

fn row() -> serde_json::Value {
    serde_json::json!({
        "userId": "u1", "expiresAt": 2000, "revokedAt": null,
        "revokeReason": null, "status": "active",
    })
}

#[test]
fn params_encode_values() {
    assert_eq!(
        find_user_by_email("a@b.c").params,
        vec![serde_json::json!("a@b.c")]
    );
    let query = touch_login("u1", None, 1000);
    assert_eq!(query.params[1], serde_json::json!(1000));
    assert_eq!(query.params[2], serde_json::Value::Null);
    let query = touch_login("u1", Some("1.2.3.4"), 1000);
    assert_eq!(query.params[2], serde_json::json!("1.2.3.4"));
}

#[test]
fn parse_refresh_maps_row() {
    let token = parse_refresh(&row(), true).unwrap();
    assert_eq!(token.user_id, "u1");
    assert_eq!(token.expires_at_unix, 2000);
    assert!(!token.user_banned);
    assert!(token.session_active);

    let banned = serde_json::json!({"status": "banned"});
    let mut banned_row = row();
    banned_row["status"] = banned["status"].clone();
    assert!(parse_refresh(&banned_row, true).unwrap().user_banned);

    let mut revoked = row();
    revoked["revokedAt"] = serde_json::json!(900);
    revoked["revokeReason"] = serde_json::json!("rotated");
    let parsed = parse_refresh(&revoked, true).unwrap();
    assert_eq!(parsed.revoked_at_unix, Some(900));
    assert_eq!(parsed.revoke_reason.as_deref(), Some("rotated"));
}

#[test]
fn parse_refresh_rejects_bad_rows() {
    assert!(parse_refresh(&serde_json::json!({}), true).is_err());
    let mut bad_epoch = row();
    bad_epoch["expiresAt"] = serde_json::json!("yesterday");
    assert!(parse_refresh(&bad_epoch, true).is_err());
}
