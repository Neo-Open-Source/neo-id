mod common;

use auth_accounts::rate_limit_allow;
use common::{MemKv, run};

#[test]
fn allows_up_to_max_then_blocks() {
    let kv = MemKv::new();
    for attempt in 1..=3 {
        assert!(
            run(rate_limit_allow(&kv, "k", 3, 60)).unwrap(),
            "attempt {attempt}"
        );
    }
    assert!(!run(rate_limit_allow(&kv, "k", 3, 60)).unwrap());
}

#[test]
fn buckets_are_independent() {
    let kv = MemKv::new();
    assert!(run(rate_limit_allow(&kv, "a", 1, 60)).unwrap());
    assert!(run(rate_limit_allow(&kv, "b", 1, 60)).unwrap());
    assert!(!run(rate_limit_allow(&kv, "a", 1, 60)).unwrap());
}
