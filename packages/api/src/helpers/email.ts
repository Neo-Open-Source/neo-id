const RESEND_ENDPOINT = "https://api.resend.com/emails";

function esc(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const BASE_TEMPLATE = (content: string) => `<!doctype html>
<html>
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:480px;background:#ffffff;border:1px solid #e5e5e5;border-radius:12px;padding:40px 32px;" cellpadding="0" cellspacing="0">
      <tr><td>${content}</td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;

export function buildMFACodeHTML(code: string): string {
  const c = esc(code);
  return BASE_TEMPLATE(`
    <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
    <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Your login code</div>
    <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Use this code to sign in. It expires in 10 minutes. If you didn't request this, you can safely ignore this email.</div>
    <div style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin-bottom:32px;">
      <div style="font-size:11px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Login code</div>
      <div style="font-size:40px;font-weight:700;color:#111111;letter-spacing:0.25em;">${c}</div>
    </div>
    <div style="font-size:12px;color:#999999;line-height:1.5;">This code is valid for 10 minutes and can only be used once.</div>`);
}

export function buildVerifyActionHTML(code: string): string {
  const c = esc(code);
  return BASE_TEMPLATE(`
    <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
    <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Verification code</div>
    <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Enter this code to confirm the action in your account settings. It expires in 10 minutes.</div>
    <div style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Verification code</div>
      <div style="font-size:40px;font-weight:700;color:#111111;letter-spacing:0.25em;">${c}</div>
    </div>
    <div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't request this, someone may be trying to change your security settings. Consider changing your password.</div>`);
}

export function buildSecurityNoticeHTML(title: string, body: string): string {
  const t = esc(title);
  const b = esc(body);
  return BASE_TEMPLATE(`
    <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
    <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">${t}</div>
    <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">${b}</div>
    <div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't make this change, please secure your account immediately by changing your password.</div>`);
}

export function buildEmailVerificationHTML(code: string, verifyURL: string): string {
  const c = esc(code);
  const u = esc(verifyURL);
  return BASE_TEMPLATE(`
    <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
    <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Verify your email</div>
    <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Enter this code to confirm your email address and activate your account.</div>
    <div style="background:#f5f5f5;border:1px solid #e5e5e5;border-radius:8px;padding:24px;text-align:center;margin-bottom:24px;">
      <div style="font-size:11px;font-weight:600;color:#999999;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:12px;">Verification code</div>
      <div style="font-size:40px;font-weight:700;color:#111111;letter-spacing:0.25em;">${c}</div>
      <div style="font-size:12px;color:#999999;margin-top:10px;">Expires in 10 minutes</div>
    </div>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${u}" style="display:inline-block;padding:12px 24px;background:#111111;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Verify by link instead</a>
    </div>
    <div style="font-size:12px;color:#999999;line-height:1.6;margin-bottom:18px;word-break:break-all;">
      Or open this link directly:<br/>
      <a href="${u}" style="color:#666666;text-decoration:underline;">${u}</a>
    </div>
    <div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't create a Neo ID account, you can safely ignore this email.</div>`);
}

async function sendRawEmail(input: {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  retries?: number;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  const maxRetries = input.retries ?? 3;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from,
          to: Array.isArray(input.to) ? input.to : [input.to],
          subject: input.subject,
          text: input.text,
          ...(input.html ? { html: input.html } : {}),
        }),
      });

      if (response.status === 429 && attempt < maxRetries) {
        const retryAfter = Math.min(2 ** attempt, 10);
        console.warn(`[email] Rate limited, retrying in ${retryAfter}s...`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error("[email] Resend error:", response.status, body);
        return false;
      }

      return true;
    } catch (e) {
      if (attempt < maxRetries) {
        const retryAfter = Math.min(2 ** attempt, 10);
        console.warn(`[email] Network error, retrying in ${retryAfter}s...`);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }
      console.error("[email] Failed after retries:", e);
      return false;
    }
  }

  return false;
}

export async function sendEmailCode(to: string, code: string): Promise<boolean> {
  return sendRawEmail({
    to,
    subject: "Neo ID verification code",
    text: `Your Neo ID verification code is: ${code}`,
    html: buildVerifyActionHTML(code),
  });
}

export async function sendLoginCodeEmail(to: string, code: string): Promise<boolean> {
  return sendRawEmail({
    to,
    subject: "Neo ID login code",
    text: `Your Neo ID login code is: ${code}`,
    html: buildMFACodeHTML(code),
  });
}

export async function sendEmailVerificationEmail(to: string, code: string, verifyLink: string): Promise<boolean> {
  return sendRawEmail({
    to,
    subject: "Verify your email — Neo ID",
    text: `Your Neo ID verification code is: ${code}. Or open: ${verifyLink}`,
    html: buildEmailVerificationHTML(code, verifyLink),
  });
}

export async function sendPasswordResetEmail(to: string, resetLink: string): Promise<boolean> {
  return sendRawEmail({
    to,
    subject: "Reset your password — Neo ID",
    text: `Click the link to reset your password: ${resetLink}`,
    html: BASE_TEMPLATE(`
      <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
      <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">Reset your password</div>
      <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;">Click the button below to reset your password. This link expires in 15 minutes.</div>
      <div style="text-align:center;margin-bottom:32px;">
        <a href="${esc(resetLink)}" style="display:inline-block;padding:12px 24px;background:#111111;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Reset password</a>
      </div>
      <div style="font-size:12px;color:#999999;line-height:1.6;margin-bottom:18px;word-break:break-all;">
        Or open this link directly:<br/>
        <a href="${esc(resetLink)}" style="color:#666666;text-decoration:underline;">${esc(resetLink)}</a>
      </div>
      <div style="font-size:12px;color:#999999;line-height:1.5;">If you didn't request a password reset, you can safely ignore this email.</div>`),
  });
}

function buildBroadcastHTML(subject: string, body: string): string {
  const urlMatch = body.match(/(https?:\/\/[^\s]+)/);
  const url = urlMatch ? urlMatch[1] : null;
  const textParts = url ? body.split(url) : [body];
  const text = textParts.join("").trim();

  const buttonHtml = url
    ? `<div style="text-align:center;margin-bottom:24px;">
        <a href="${esc(url)}" style="display:inline-block;padding:12px 24px;background:#111111;color:#ffffff;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">Learn more</a>
       </div>`
    : "";

  const linkHtml = url
    ? `<div style="font-size:12px;color:#999999;line-height:1.6;margin-bottom:18px;word-break:break-all;">
        Or open this link directly:<br/>
        <a href="${esc(url)}" style="color:#666666;text-decoration:underline;">${esc(url)}</a>
       </div>`
    : "";

  return BASE_TEMPLATE(`
    <div style="font-size:18px;font-weight:700;color:#111111;letter-spacing:-0.3px;margin-bottom:24px;">Neo ID</div>
    <div style="font-size:22px;font-weight:700;color:#111111;letter-spacing:-0.5px;margin-bottom:8px;">${esc(subject)}</div>
    <div style="font-size:14px;color:#666666;line-height:1.5;margin-bottom:32px;white-space:pre-wrap;">${esc(text)}</div>
    ${buttonHtml}
    ${linkHtml}
    <div style="font-size:12px;color:#999999;line-height:1.5;border-top:1px solid #e5e5e5;padding-top:18px;margin-top:8px;">
      This message was sent by Neo ID. If you no longer wish to receive these emails, you can unsubscribe in your account settings.
    </div>`);
}

async function sendSingleBroadcast(recipient: string, subject: string, body: string): Promise<boolean> {
  return sendRawEmail({
    to: recipient,
    subject,
    text: body,
    html: buildBroadcastHTML(subject, body),
  });
}

export async function sendBroadcastEmail(input: {
  to: string[];
  subject: string;
  body: string;
}): Promise<{ sent: number; failed: number }> {
  const CONCURRENCY = 10;
  const results: boolean[] = [];

  for (let i = 0; i < input.to.length; i += CONCURRENCY) {
    const batch = input.to.slice(i, i + CONCURRENCY);
    const settled = await Promise.allSettled(
      batch.map((r) => sendSingleBroadcast(r, input.subject, input.body)),
    );
    for (const r of settled) {
      if (r.status === "fulfilled" && r.value) results.push(true);
      else results.push(false);
    }
  }

  return {
    sent: results.filter(Boolean).length,
    failed: results.filter((r) => !r).length,
  };
}
