import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Button, Container, Card, CardContent, Stack, Divider, Link } from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'

export default function PrivacyPage() {
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
              <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Privacy Policy</Typography>
              <Typography color="text.secondary">Last updated: April 5, 2026</Typography>
              <Divider />

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>1. Scope</Typography>
                <Typography color="text.secondary">
                  This Privacy Policy explains how Neo ID collects, uses, and shares information when you use our identity and
                  authentication services (the "Service"), including our website, APIs, and OAuth-based sign-in.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>2. Information We Collect</Typography>
                <Typography color="text.secondary">
                  Depending on how you use the Service, we may collect:
                  <br />- Account information: email address, display name, password hash (for email/password accounts)
                  <br />- OAuth information: provider name and provider user identifier (e.g., Google/GitHub ID)
                  <br />- Session and security data: session identifiers, token identifiers, IP address, user agent, timestamps
                  <br />- Connected applications: the applications/sites you authorize to sign in with Neo ID
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>3. How We Use Information</Typography>
                <Typography color="text.secondary">
                  We use information to:
                  <br />- provide authentication and account features
                  <br />- maintain sessions and issue/verify access tokens
                  <br />- protect the Service from abuse, fraud, and security incidents
                  <br />- troubleshoot, monitor, and improve reliability and performance
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>4. Sharing</Typography>
                <Typography color="text.secondary">
                  We share information in the following ways:
                  <br />- With applications you authorize: when you sign in to a connected application, Neo ID provides an access
                  token or user information necessary to complete authentication.
                  <br />- With service providers: we may use infrastructure providers to host and operate the Service.
                  <br />- For security and legal reasons: to protect users, prevent abuse, or comply with valid legal requests.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>5. Data Retention</Typography>
                <Typography color="text.secondary">
                  We retain account information for as long as your account remains active. Session and security logs may be stored
                  for a limited period to operate the Service and protect against abuse. When you delete your account (if available
                  in the product), we delete or anonymize personal data unless retention is required for security or legal purposes.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>6. Your Choices and Rights</Typography>
                <Typography color="text.secondary">
                  You can:
                  <br />- update your profile information (if available)
                  <br />- change your password
                  <br />- manage linked OAuth providers (if available)
                  <br />- revoke access for connected applications (if available)
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>7. Security</Typography>
                <Typography color="text.secondary">
                  We use reasonable security measures to protect the Service and your data. No method of transmission or storage
                  is completely secure, and we cannot guarantee absolute security.
                </Typography>
              </Stack>

              <Stack spacing={1}>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>8. Changes to this Policy</Typography>
                <Typography color="text.secondary">
                  We may update this Privacy Policy from time to time. The "Last updated" date indicates when changes were last made.
                </Typography>
              </Stack>

              <Divider />
              <Typography variant="body2" color="text.secondary">
                See also: <Link href="/terms" underline="hover">Terms of Service</Link>
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </>
  )
}
