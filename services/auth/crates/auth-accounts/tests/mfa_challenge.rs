mod common;

use auth_accounts::{
    Attempt, MfaChallenge, clear_challenge, fail_attempt, load_challenge, store_challenge,
};
use common::{MemKv, run};

fn challenge() -> MfaChallenge {
    MfaChallenge {
        user_id: "u1".to_string(),
        email: "a@b.c".to_string(),
        role: "user".to_string(),
        totp: true,
        email_mfa: false,
        passkey: false,
    }
}

#[test]
fn challenge_round_trips_and_clears() {
    let kv = MemKv::new();
    run(store_challenge(&kv, "c1", &challenge())).unwrap();
    assert_eq!(run(load_challenge(&kv, "c1")).unwrap(), Some(challenge()));
    run(clear_challenge(&kv, "c1")).unwrap();
    assert_eq!(run(load_challenge(&kv, "c1")).unwrap(), None);
}

#[test]
fn unknown_challenge_is_absent() {
    let kv = MemKv::new();
    assert_eq!(run(load_challenge(&kv, "nope")).unwrap(), None);
}

#[test]
fn failed_attempts_lock_and_drop_the_challenge() {
    let kv = MemKv::new();
    run(store_challenge(&kv, "c1", &challenge())).unwrap();
    for attempt in 1..=4 {
        assert_eq!(
            run(fail_attempt(&kv, "c1")).unwrap(),
            Attempt::Allowed,
            "attempt {attempt}"
        );
    }
    assert_eq!(run(fail_attempt(&kv, "c1")).unwrap(), Attempt::Locked);
    assert_eq!(run(load_challenge(&kv, "c1")).unwrap(), None);
}
