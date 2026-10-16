pub const CODE_LENGTH: usize = 6;
pub const CODE_EXPIRY: u64 = 600;
pub const RESEND_COOLDOWN: u64 = 60;

#[must_use]
pub fn normalize(email: &str) -> String {
    email.trim().to_lowercase()
}

#[must_use]
pub fn mask(email: &str) -> String {
    match email.find('@') {
        Some(at) if at >= 2 => {
            let mut masked = email[..2].to_string();
            masked.push_str("***");
            masked.push_str(&email[at..]);
            masked
        }
        _ => "***".to_string(),
    }
}

#[must_use]
pub fn valid_code_format(code: &str) -> bool {
    code.len() == CODE_LENGTH && code.bytes().all(|b| b.is_ascii_digit())
}

#[must_use]
pub fn resend_remaining_s(last_sent_at: u64, now: u64) -> u64 {
    RESEND_COOLDOWN.saturating_sub(now.saturating_sub(last_sent_at))
}
