use super::brand::Brand;

#[must_use]
pub(crate) fn esc(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for ch in value.chars() {
        match ch {
            '&' => out.push_str("&amp;"),
            '<' => out.push_str("&lt;"),
            '>' => out.push_str("&gt;"),
            '"' => out.push_str("&quot;"),
            _ => out.push(ch),
        }
    }
    out
}

#[must_use]
pub(crate) fn base(content: &str) -> String {
    format!(
        "<!doctype html>\n<html>\n<head><meta charset=\"utf-8\"/>\
        <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"/></head>\n\
        <body style=\"margin:0;padding:0;background:#f5f5f5;\
        font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;\">\n\
        <table width=\"100%\" cellpadding=\"0\" cellspacing=\"0\" \
        style=\"padding:40px 16px;\">\n  <tr><td align=\"center\">\n    \
        <table width=\"100%\" style=\"max-width:480px;background:#ffffff;\
        border:1px solid #e5e5e5;border-radius:12px;padding:40px 32px;\" \
        cellpadding=\"0\" cellspacing=\"0\">\n      <tr><td>{content}</td></tr>\n    \
        </table>\n  </td></tr>\n</table>\n</body>\n</html>"
    )
}

fn header(brand: &Brand) -> String {
    let name = esc(&brand.name);
    let logo = brand
        .logo_url
        .as_deref()
        .map(|url| {
            format!(
                "<img src=\"{}\" alt=\"{name}\" style=\"height:32px;margin-bottom:16px;\"/>",
                esc(url)
            )
        })
        .unwrap_or_default();
    format!(
        "{logo}<div style=\"font-size:18px;font-weight:700;color:{};letter-spacing:-0.3px;margin-bottom:24px;\">{name}</div>",
        brand.accent
    )
}

fn code_box(brand: &Brand, label: &str, code: &str, footnote: &str) -> String {
    format!(
        r#"<div style="background:{};border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">"#,
        brand.tint()
    ) + &format!(
        r#"  <div style="font-size:11px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">{label}</div>"#
    ) + &format!(
        r#"  <div style="font-size:40px;font-weight:700;color:#111111;letter-spacing:0.25em;">{code}</div>"#
    ) + "</div>"
        + &format!(r#"<div style="font-size:12px;color:#999999;line-height:1.5;">{footnote}</div>"#)
}

fn button(brand: &Brand, link: &str, label: &str) -> String {
    r#"<div style="text-align:center;margin-bottom:32px;">"#.to_string()
        + &format!(
            r#"  <a href="{link}" style="display:inline-block;padding:12px 24px;background:{};color:{};border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">{label}</a>"#,
            brand.accent,
            brand.button_text()
        )
        + "</div>"
}

fn link_fallback(link: &str) -> String {
    r#"<div style="font-size:12px;color:#999999;line-height:1.6;margin-bottom:18px;word-break:break-all;">"#.to_string()
        + "  Or open this link directly:<br/>"
        + &format!(
            r#"  <a href="{link}" style="color:#666666;text-decoration:underline;">{link}</a>"#
        )
        + "</div>"
}

#[must_use]
pub(crate) fn mfa_code(brand: &Brand, code: &str) -> String {
    let inner = [
        header(brand),
        r#"<div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Your login code</div>"#.to_string(),
        r#"<div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Use this code to sign in. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.</div>"#.to_string(),
        code_box(brand, "Login code", &esc(code), "This code is valid for 10 minutes and can only be used once."),
    ]
    .join("\n    ");
    base(&format!("\n    {inner}"))
}

#[must_use]
pub(crate) fn verify_action(brand: &Brand, code: &str) -> String {
    let inner = [
        header(brand),
        r#"<div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Verification code</div>"#.to_string(),
        r#"<div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Enter this code to confirm the action in your account settings. It expires in 10 minutes.</div>"#.to_string(),
        code_box(brand, "Verification code", &esc(code), "If you didn't request this, someone may be trying to change your security settings. Consider changing your password."),
    ]
    .join("\n    ");
    base(&format!("\n    {inner}"))
}

#[must_use]
pub(crate) fn security_notice(brand: &Brand, title: &str, body: &str) -> String {
    let inner = [
        header(brand),
        format!(
            r#"<div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">{}</div>"#,
            esc(title)
        ),
        format!(
            r#"<div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">{}</div>"#,
            esc(body)
        ),
        r#"<div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't make this change, please secure your account immediately by changing your password.</div>"#.to_string(),
    ]
    .join("\n    ");
    base(&format!("\n    {inner}"))
}

#[must_use]
pub(crate) fn verify_email(brand: &Brand, code: &str, link: &str) -> String {
    let link = esc(link);
    let inner = [
        header(brand),
        r#"<div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Verify your email</div>"#.to_string(),
        r#"<div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Enter this code to confirm your email address and activate your account.</div>"#.to_string(),
        code_box(brand, "Verification code", &esc(code), "Expires in 10 minutes"),
        button(brand, &link, "Verify by link instead"),
        link_fallback(&link),
        format!(
            r#"<div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't create a {} account, you can safely ignore this email.</div>"#,
            esc(&brand.name)
        ),
    ]
    .join("\n    ");
    base(&format!("\n    {inner}"))
}

#[must_use]
pub(crate) fn reset_password(brand: &Brand, link: &str) -> String {
    let link = esc(link);
    let inner = [
        header(brand),
        r#"<div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Reset your password</div>"#.to_string(),
        r#"<div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Click the button below to reset your password. This link expires in 15 minutes.</div>"#.to_string(),
        button(brand, &link, "Reset password"),
        link_fallback(&link),
        r#"<div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't request a password reset, you can safely ignore this email.</div>"#.to_string(),
    ]
    .join("\n    ");
    base(&format!("\n    {inner}"))
}

#[cfg(test)]
mod tests {
    use super::{
        base, esc, mfa_code, reset_password, security_notice, verify_action, verify_email,
    };
    use crate::brand::Brand;

    fn mega() -> Brand {
        Brand::sanitize(
            Some("MegaApp"),
            Some("#ffcc00"),
            Some("https://cdn.example/logo.png"),
        )
    }

    #[test]
    fn esc_replaces_reserved_characters_once() {
        assert_eq!(
            esc("<a href=\"x&y\">"),
            "&lt;a href=&quot;x&amp;y&quot;&gt;"
        );
        assert_eq!(esc("plain"), "plain");
        assert_eq!(esc("it's / fine"), "it's / fine");
    }

    #[test]
    fn base_shell_wraps_content() {
        let html = base("hello");
        assert!(html.starts_with("<!doctype html>"));
        assert!(html.ends_with("</html>"));
        assert!(html.contains("max-width:480px"));
        assert!(html.contains("<tr><td>hello</td></tr>"));
    }

    #[test]
    fn default_brand_matches_typescript_contract() {
        let brand = Brand::neo_id();
        assert!(mfa_code(&brand, "1").contains(">Neo ID</div>"));
        assert!(verify_email(&brand, "1", "https://x").contains("Neo ID account"));
        assert!(!mfa_code(&brand, "1").contains("<img"));
    }

    #[test]
    fn custom_brand_replaces_name_accent_and_logo() {
        let brand = mega();
        let html = mfa_code(&brand, "23908");
        assert!(html.contains(">MegaApp</div>"));
        assert!(!html.contains("Neo ID"));
        assert!(html.contains("https://cdn.example/logo.png"));
        assert!(html.contains("background:#FFCC00") || html.contains("#FFCC00"));
        assert!(html.contains("23908"));
    }

    #[test]
    fn mfa_code_interpolates_escaped_code() {
        let html = mfa_code(&Brand::neo_id(), "<123>");
        assert!(html.contains("Your login code"));
        assert!(html.contains("Login code"));
        assert!(html.contains("&lt;123&gt;"));
        assert!(!html.contains("<123>"));
        assert!(html.contains("This code is valid for 10 minutes"));
        assert!(html.contains("<!doctype html>"));
    }

    #[test]
    fn verify_action_marks_security_context() {
        let html = verify_action(&Brand::neo_id(), "9&9");
        assert!(html.contains("Verification code"));
        assert!(html.contains("account settings"));
        assert!(html.contains("9&amp;9"));
        assert!(html.contains("Consider changing your password"));
    }

    #[test]
    fn verify_email_embeds_code_and_link() {
        let html = verify_email(&Brand::neo_id(), "42", "https://id.neome.uk/v?a=1&b=2");
        assert!(html.contains("Verify your email"));
        assert!(html.contains("Verify by link instead"));
        assert!(html.contains("42"));
        assert!(html.contains("https://id.neome.uk/v?a=1&amp;b=2"));
        assert!(!html.contains("a=1&b=2\""));
        assert_eq!(html.matches("https://id.neome.uk/v?a=1&amp;b=2").count(), 3);
    }

    #[test]
    fn reset_password_embeds_escaped_link() {
        let html = reset_password(&Brand::neo_id(), "https://id.neome.uk/r?t=<tok>");
        assert!(html.contains("Reset your password"));
        assert!(html.contains("expires in 15 minutes"));
        assert!(html.contains("https://id.neome.uk/r?t=&lt;tok&gt;"));
        assert_eq!(
            html.matches("https://id.neome.uk/r?t=&lt;tok&gt;").count(),
            3
        );
    }

    #[test]
    fn security_notice_escapes_title_and_body() {
        let html = security_notice(
            &Brand::neo_id(),
            "<b>New login</b>",
            "From \"Berlin\" & phone",
        );
        assert!(html.contains("&lt;b&gt;New login&lt;/b&gt;"));
        assert!(html.contains("From &quot;Berlin&quot; &amp; phone"));
        assert!(html.contains("secure your account immediately"));
        assert!(!html.contains("<b>"));
    }
}
