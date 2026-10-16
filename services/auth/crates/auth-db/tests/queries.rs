use auth_db::*;

fn placeholders(sql: &str) -> usize {
    (1..=16).filter(|n| sql.contains(&format!("${n}"))).count()
}

#[test]
fn every_builder_binds_all_placeholders() {
    let queries = vec![
        find_user_by_email("a@b.c"),
        find_user_by_id("u1"),
        touch_login("u1", Some("1.2.3.4"), 1000),
        create_session("u1", None, None, 2000),
        find_session("s1"),
        touch_session("s1", None, None, 2000),
        deactivate_session("s1"),
        deactivate_user_sessions("u1"),
        find_refresh("hash"),
        create_refresh("u1", "s1", "hash", None, None, None, 2000),
        revoke_refresh("r1", "rotated", 1000),
        create_code(
            "code",
            "app",
            "https://a/cb",
            Some("ch"),
            Some("s1"),
            "u1",
            2000,
        ),
        find_code("code", "app", "https://a/cb", 1000),
        delete_code("code"),
        find_client("client-1"),
        upsert_envelope("u1", "env"),
        find_envelope("u1"),
        delete_envelope("u1"),
        insert_passkey("u1", "cid", "key", None, false, false),
        passkeys_by_user("u1"),
        update_counter("cid", 7),
        delete_passkey("cid", "u1"),
    ];
    for query in queries {
        assert_eq!(placeholders(query.sql), query.params.len(), "{}", query.sql);
    }
}

#[test]
fn identifiers_are_quoted() {
    assert!(find_user_by_email("a").sql.contains(r#""users""#));
    assert!(find_refresh("h").sql.contains(r#""refresh_tokens""#));
    assert!(
        find_code("c", "a", "r", 1)
            .sql
            .contains(r#""oauth_states""#)
    );
}
