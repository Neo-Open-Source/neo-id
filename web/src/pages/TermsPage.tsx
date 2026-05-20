import MobilePageShell from '../components/MobilePageShell'
import styles from '../styles/LegalPage.module.css'

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className={styles.section}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      <p className={styles.sectionBody}>{children}</p>
    </div>
  )
}

export default function TermsPage() {
  return (
    <MobilePageShell backTo={-1} title="Terms of Service" desktopSimple>
      <div className={styles.page}>
        <div className={styles.card}>
          <div className={styles.stack}>
            <div>
              <h1 className={styles.title}>Terms of Service</h1>
              <p className={styles.updated}>Last updated: May 21, 2026</p>
            </div>
            <hr className={styles.divider} />
            <Section title="1. Acceptance of these Terms">These Terms of Service ("Terms") govern your access to and use of Neo ID, including our websites, APIs, and authentication services (the "Service"). By creating an account or using the Service, you agree to these Terms. If you do not agree, do not use the Service.</Section>
            <Section title="2. The Service">Neo ID provides identity and authentication features, such as email/password login, OAuth login (e.g., Google, GitHub), session management, and access tokens. The Service may evolve over time. We may add, change, or remove features at any time.</Section>
            <Section title="3. Accounts and Security">You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs under your account. Do not share passwords or tokens. Notify us promptly if you believe your account has been compromised.</Section>
            <Section title="4. Prohibited Use">You must not use the Service to violate any applicable law or regulation, attempt to gain unauthorized access to accounts or systems, interfere with or disrupt the Service, distribute malware or harmful code, misuse OAuth flows or API keys, or infringe the rights of others.</Section>
            <Section title="5. Availability">We aim to keep the Service available and reliable, but the Service is provided on an "as is" and "as available" basis. We do not guarantee uninterrupted operation.</Section>
            <Section title="6. Third-Party Services">The Service may integrate with third-party services (for example, OAuth providers). Your use of those third-party services is governed by their own terms and policies. We are not responsible for third-party services.</Section>
            <Section title="7. Connected Applications">When you sign in to a connected application using Neo ID, you authorize Neo ID to provide that application with information and tokens needed to complete authentication. Connected applications are responsible for how they use the information they receive.</Section>
            <Section title="8. Termination">We may suspend or terminate your access to the Service if we reasonably believe you have violated these Terms, used the Service in a harmful way, or pose a security risk. You may stop using the Service at any time.</Section>
            <Section title="9. Intellectual Property and Scope of these Terms">Neo ID source code is open-source and distributed under the MIT License. These Terms do not replace or modify that software license. These Terms apply only to your use of the public Neo ID service instance operated by the administrators, including its infrastructure, hosted APIs, and servers.</Section>
            <Section title="10. Disclaimer of Warranties">The Service is provided "as is" and "as available". To the maximum extent permitted by law, Neo ID disclaims all warranties, express or implied, including implied warranties of merchantability, fitness for a particular purpose, and non-infringement.</Section>
            <Section title="11. Limitation of Liability">To the maximum extent permitted by law, Neo ID will not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits, data, use, goodwill, or other intangible losses, arising from or related to your use of the Service.</Section>
            <Section title="12. Privacy Policy">Any personal data collected and processed as part of the Service is handled in accordance with our <a href="/privacy" className={styles.linkUnderline}>Privacy Policy</a>.</Section>
            <Section title="13. Changes to these Terms">We may update these Terms from time to time. The "Last updated" date indicates when changes were last made. Your continued use of the Service after changes become effective means you accept the updated Terms.</Section>
            <Section title="14. Governing Law">These Terms are governed by the laws of Moldova, without regard to its conflict of law principles. Any disputes shall be resolved in the competent courts of Moldova.</Section>
            <Section title="15. Contact">For questions about these Terms, contact Neo ID administration at <a href="mailto:fenixoffc@gmail.com" className={styles.linkUnderline}>fenixoffc@gmail.com</a>.</Section>
            <hr className={styles.divider} />
            <p className={styles.seeAlso}>See also: <a href="/privacy" className={styles.linkPlain}>Privacy Policy</a></p>
          </div>
        </div>
      </div>
    </MobilePageShell>
  )
}
