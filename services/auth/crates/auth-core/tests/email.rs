use auth_core::{mask, normalize, resend_remaining_s, valid_code_format};

#[test]
fn normalize_trims_and_lowercases() {
    assert_eq!(normalize("  Alice@Example.COM "), "alice@example.com");
}

#[test]
fn mask_hides_local_part() {
    assert_eq!(mask("alice@example.com"), "al***@example.com");
    assert_eq!(mask("a@b.c"), "***");
    assert_eq!(mask("no-at-sign"), "***");
}

#[test]
fn code_format_is_six_digits() {
    assert!(valid_code_format("123456"));
    assert!(!valid_code_format("12345"));
    assert!(!valid_code_format("1234567"));
    assert!(!valid_code_format("abcdef"));
}

#[test]
fn cooldown_counts_down_then_zero() {
    assert_eq!(resend_remaining_s(1000, 1010), 50);
    assert_eq!(resend_remaining_s(1000, 1060), 0);
    assert_eq!(resend_remaining_s(1000, 2000), 0);
}
