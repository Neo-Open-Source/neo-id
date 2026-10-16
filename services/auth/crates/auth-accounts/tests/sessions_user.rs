mod common;

use auth_accounts::{list_sessions, revoke_all_sessions, revoke_session, update_user_profile};
use common::{Scripted, run};

#[test]
fn session_list_and_revoke() {
    let listed = Scripted::feed(vec![vec![serde_json::json!({"id": "s1"})]]);
    let rows = run(list_sessions(&listed, "u1")).unwrap();
    assert_eq!(rows.len(), 1);
    assert_eq!(rows[0]["id"], "s1");

    let owned = Scripted::feed(vec![
        vec![serde_json::json!({"id": "s1", "userId": "u1"})],
        vec![],
        vec![],
    ]);
    assert!(run(revoke_session(&owned, "s1", "u1", 1000)).unwrap());
    assert!(owned.ran("refresh_tokens"));

    let foreign = Scripted::feed(vec![vec![serde_json::json!({"id": "s1", "userId": "u9"})]]);
    assert!(!run(revoke_session(&foreign, "s1", "u1", 1000)).unwrap());

    let all = Scripted::feed(vec![vec![], vec![]]);
    run(revoke_all_sessions(&all, "u1", 1000)).unwrap();
    assert!(all.ran("refresh_tokens"));
}

#[test]
fn profile_update_passthrough() {
    let db = Scripted::feed(vec![vec![]]);
    run(update_user_profile(&db, "u1", Some("Al"), None, None)).unwrap();
    assert!(db.ran("UPDATE \"users\""));
}
