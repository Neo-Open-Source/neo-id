#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Brand {
    pub(crate) name: String,
    pub(crate) accent: String,
    pub(crate) logo_url: Option<String>,
}

impl Brand {
    #[must_use]
    pub(crate) fn neo_id() -> Self {
        Self {
            name: "Neo ID".to_string(),
            accent: "#111111".to_string(),
            logo_url: None,
        }
    }

    #[must_use]
    pub(crate) fn sanitize(
        name: Option<&str>,
        accent: Option<&str>,
        logo_url: Option<&str>,
    ) -> Self {
        let name = match name.map(str::trim).filter(|name| !name.is_empty()) {
            Some(name) => name.chars().take(60).collect(),
            None => "Neo ID".to_string(),
        };
        let accent = match accent.and_then(parse_hex) {
            Some((r, g, b)) => format!("#{r:02X}{g:02X}{b:02X}"),
            None => "#111111".to_string(),
        };
        let logo_url = logo_url
            .filter(|url| url.starts_with("https://"))
            .map(String::from);
        Self {
            name,
            accent,
            logo_url,
        }
    }

    #[must_use]
    pub(crate) fn button_text(&self) -> &'static str {
        let (r, g, b) = parse_hex(&self.accent).unwrap_or((17, 17, 17));
        let luminance =
            (0.2126 * f64::from(r) + 0.7152 * f64::from(g) + 0.0722 * f64::from(b)) / 255.0;
        if luminance > 0.5 {
            "#111111"
        } else {
            "#ffffff"
        }
    }

    #[must_use]
    pub(crate) fn tint(&self) -> String {
        let (r, g, b) = parse_hex(&self.accent).unwrap_or((17, 17, 17));
        let mix = |channel: u8| {
            u8::try_from(u16::from(channel) + (255 - u16::from(channel)) * 88 / 100).unwrap_or(255)
        };
        format!("#{:02X}{:02X}{:02X}", mix(r), mix(g), mix(b))
    }
}

fn channel(hex: &str, at: usize) -> Option<u8> {
    u8::from_str_radix(&hex[at..at + 2], 16).ok()
}

fn parse_hex(value: &str) -> Option<(u8, u8, u8)> {
    let hex = value.strip_prefix('#').unwrap_or(value);
    let expanded: String = match hex.len() {
        3 => hex.chars().flat_map(|ch| [ch, ch]).collect(),
        6 => hex.to_string(),
        _ => return None,
    };
    if !expanded.bytes().all(|byte| byte.is_ascii_hexdigit()) {
        return None;
    }
    Some((
        channel(&expanded, 0)?,
        channel(&expanded, 2)?,
        channel(&expanded, 4)?,
    ))
}

#[cfg(test)]
mod tests {
    use super::Brand;

    #[test]
    fn sanitize_falls_back_on_garbage() {
        let brand = Brand::sanitize(Some("  "), Some("red"), Some("javascript:alert(1)"));
        assert_eq!(brand.name, "Neo ID");
        assert_eq!(brand.accent, "#111111");
        assert_eq!(brand.logo_url, None);
    }

    #[test]
    fn sanitize_accepts_brand() {
        let brand = Brand::sanitize(
            Some("  MegaApp  "),
            Some("#fc0"),
            Some("https://cdn.example/logo.png"),
        );
        assert_eq!(brand.name, "MegaApp");
        assert_eq!(brand.accent, "#FFCC00");
        assert_eq!(
            brand.logo_url.as_deref(),
            Some("https://cdn.example/logo.png")
        );
    }

    #[test]
    fn button_text_contrasts() {
        assert_eq!(
            Brand::sanitize(None, Some("#ffcc00"), None).button_text(),
            "#111111"
        );
        assert_eq!(
            Brand::sanitize(None, Some("#111111"), None).button_text(),
            "#ffffff"
        );
    }

    #[test]
    fn tint_lightens_toward_white() {
        assert_eq!(
            Brand::sanitize(None, Some("#ffcc00"), None).tint(),
            "#FFF8E0"
        );
        assert_eq!(
            Brand::sanitize(None, Some("#111111"), None).tint(),
            "#E2E2E2"
        );
    }
}
