import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Button, Container, Card, CardContent, Stack, Divider, Link } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function TermsPage() {
  const navigate = useNavigate()

  return (
    <>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar>
          <Typography sx={{ flexGrow: 1, fontWeight: 700 }} variant="h6">Neo ID</Typography>
          <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(-1)}>Back</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ py: { xs: 3, sm: 4 } }}>
        <Card>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={2}>
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Terms of Service</Typography>
              <Typography color="text.secondary">Last updated: April 5, 2026</Typography>
              <Divider />

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>1. Acceptance of these Terms</Typography>
                <Typography color="text.secondary">
                  These Terms of Service ("Terms") govern your access to and use of Neo ID, including our websites, APIs, and
                  authentication services (the "Service"). By creating an account or using the Service, you agree to these Terms.
                  If you do not agree, do not use the Service.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>2. The Service</Typography>
                <Typography color="text.secondary">
                  Neo ID provides identity and authentication features, such as email/password login, OAuth login (e.g., Google,
                  GitHub), session management, and access tokens. The Service may evolve over time. We may add, change, or remove
                  features at any time.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>3. Accounts and Security</Typography>
                <Typography color="text.secondary">
                  You are responsible for maintaining the confidentiality of your credentials and for all activity that occurs
                  under your account. Do not share passwords or tokens. Notify us promptly if you believe your account has been
                  compromised.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>4. Prohibited Use</Typography>
                <Typography color="text.secondary">
                  You must not use the Service to:
                  <br />- violate any applicable law or regulation
                  <br />- attempt to gain unauthorized access to accounts, systems, or networks
                  <br />- interfere with or disrupt the Service (including abuse, scanning, or denial-of-service)
                  <br />- distribute malware or harmful code
                  <br />- misuse OAuth flows, tokens, or API keys
                  <br />- infringe the rights of others
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>5. Availability</Typography>
                <Typography color="text.secondary">
                  We aim to keep the Service available and reliable, but the Service is provided on an "as is" and "as available"
                  basis. We do not guarantee uninterrupted operation.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>6. Third-Party Services</Typography>
                <Typography color="text.secondary">
                  The Service may integrate with third-party services (for example, OAuth providers). Your use of those third-party
                  services is governed by their own terms and policies. We are not responsible for third-party services.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>7. Connected Applications</Typography>
                <Typography color="text.secondary">
                  When you sign in to a connected application using Neo ID, you authorize Neo ID to provide that application with
                  information and tokens needed to complete authentication. Connected applications are responsible for how they use
                  the information they receive.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>8. Termination</Typography>
                <Typography color="text.secondary">
                  We may suspend or terminate your access to the Service if we reasonably believe you have violated these Terms,
                  used the Service in a harmful way, or pose a security risk. You may stop using the Service at any time.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>9. Intellectual Property</Typography>
                <Typography color="text.secondary">
                  The Service, including its software, design, and trademarks, is owned by Neo ID and its licensors and is protected
                  by applicable laws. You receive a limited, non-exclusive, non-transferable right to use the Service in accordance
                  with these Terms.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>10. Disclaimer of Warranties</Typography>
                <Typography color="text.secondary">
                  The Service is provided "as is" and "as available". To the maximum extent permitted by law, Neo ID disclaims all
                  warranties, express or implied, including implied warranties of merchantability, fitness for a particular purpose,
                  and non-infringement.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>11. Limitation of Liability</Typography>
                <Typography color="text.secondary">
                  To the maximum extent permitted by law, Neo ID will not be liable for any indirect, incidental, special,
                  consequential, or punitive damages, or any loss of profits, data, use, goodwill, or other intangible losses,
                  arising from or related to your use of the Service.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>12. Changes to these Terms</Typography>
                <Typography color="text.secondary">
                  We may update these Terms from time to time. The "Last updated" date indicates when changes were last made.
                  Your continued use of the Service after changes become effective means you accept the updated Terms.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>13. Contact</Typography>
                <Typography color="text.secondary">
                  For questions about these Terms, please contact the Neo ID administrators.
                </Typography>
              </Stack>

              <Divider />
              <Typography variant="body2" color="text.secondary">
                See also: <Link href="/privacy" underline="hover">Privacy Policy</Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </>
  )
}
