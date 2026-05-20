import MobilePageShell from '../components/MobilePageShell'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <h3 style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', lineHeight: 1.6 }}>{children}</p>
    </div>
  )
}

export default function PrivacyPage() {
  return (
    <MobilePageShell backTo={-1}>
      <div className="neo-id-legal-page" style={{ width: 'min(100%, 760px)', margin: '0 auto' }}>
        <div className="neo-id-legal-card" style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 24, padding: 32 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div>
              <h1 style={{ margin: '0 0 4px', fontWeight: 800, fontSize: '1.75rem', letterSpacing: '-0.5px' }}>Privacy Policy</h1>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>Last updated: May 21, 2026</p>
            </div>
            <hr style={{ border: 'none', borderTop: '1px solid var(--neo-border-subtle)', margin: 0 }} />
            <Section title="1. Scope">This Privacy Policy explains how Neo ID collects, uses, and shares information when you use our identity and authentication services (the "Service"), including our website, APIs, and OAuth-based sign-in.</Section>
            <Section title="2. Information We Collect">Depending on how you use the Service, we may collect: account information (email address, display name, password hash), OAuth information (provider name and provider user identifier), session and security data (session identifiers, token identifiers, IP address, user agent, timestamps), and connected applications you authorize. We also use strictly essential cookies and browser local storage for session/authentication functionality, including active session management and storing JWT authorization tokens. We do not use marketing or tracking cookies.</Section>
            <Section title="3. How We Use Information">We use information to provide authentication and account features, maintain sessions and issue/verify access tokens, protect the Service from abuse, fraud, and security incidents, and troubleshoot, monitor, and improve reliability and performance.</Section>
            <Section title="4. Sharing">We share information with applications you authorize (when you sign in, Neo ID provides an access token or user information necessary to complete authentication), with infrastructure providers to host and operate the Service, and for security and legal reasons to protect users or comply with valid legal requests.</Section>
            <Section title="5. Data Retention and Account Deletion">We retain account information for as long as your account remains active. Session and security logs may be stored for a limited period. You can request account deletion via the user dashboard or by contacting administrators directly. When your account is deleted, we delete or anonymize personal data unless retention is required for security or legal purposes.</Section>
            <Section title="6. Your Choices and Rights">You can update your profile information, change your password, manage linked OAuth providers, and revoke access for connected applications (where available in the product). If you are in the EU, you may also request withdrawal of consent (where processing is based on consent), erasure of personal data (right to be forgotten), and export of your personal data by contacting Neo ID administrators.</Section>
            <Section title="7. Security">We use reasonable security measures to protect the Service and your data. No method of transmission or storage is completely secure, and we cannot guarantee absolute security.</Section>
            <Section title="8. Changes to this Policy">We may update this Privacy Policy from time to time. The "Last updated" date indicates when changes were last made.</Section>
            <Section title="9. Contact">For privacy-related questions or requests, contact Neo ID administration at <a href="mailto:fenixoffc@gmail.com" style={{ color: 'inherit', textDecoration: 'underline' }}>fenixoffc@gmail.com</a>.</Section>
            <hr style={{ border: 'none', borderTop: '1px solid var(--neo-border-subtle)', margin: 0 }} />
            <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>See also: <a href="/terms" style={{ color: 'inherit' }}>Terms of Service</a></p>
          </div>
        </div>
      </div>
      <style>{`
        html[data-theme='light'] .neo-id-legal-card {
          background: #ffffff !important;
          border-color: #e4e8ee !important;
          box-shadow: 0 12px 28px rgba(15, 23, 42, 0.05);
        }
      `}</style>
    </MobilePageShell>
  )
}
