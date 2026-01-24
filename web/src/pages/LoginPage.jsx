import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link as RouterLink } from 'react-router-dom'
import { Box, Container, Stack, Typography, TextField, Button, Divider, Alert, Card, CardContent, Tabs, Tab, Link } from '@mui/material'
import GoogleIcon from '@mui/icons-material/Google'
import GitHubIcon from '@mui/icons-material/GitHub'
import { passwordLogin, passwordRegister } from '../api/endpoints'
import { setTokens } from '../api/client'

export default function LoginPage() {
  const navigate = useNavigate()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const oauthLogin = (provider) => {
    window.location.href = `/api/auth/login/${provider}`
  }

  const onPasswordLogin = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await passwordLogin(email, password)
      setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
      navigate('/dashboard')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const onPasswordRegister = async () => {
    setLoading(true)
    setError('')
    try {
      const data = await passwordRegister(email, password, displayName)
      setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
      navigate('/dashboard')
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', py: { xs: 4, sm: 6 } }}>
      <Container maxWidth="sm">
        <Card elevation={0} sx={{ overflow: 'hidden' }}>
          <CardContent sx={{ p: { xs: 3, sm: 4 } }}>
            <Stack spacing={3}>
              <Stack spacing={0.5}>
                <Typography variant="h4" sx={{ fontWeight: 800, letterSpacing: -0.5 }}>Neo ID</Typography>
                <Typography color="text.secondary">Secure sign‑in for your apps</Typography>
              </Stack>

              <Tabs
                value={mode}
                onChange={(_, v) => setMode(v)}
                variant="fullWidth"
                sx={{
                  minHeight: 44,
                  borderRadius: 3,
                  border: '1px solid rgba(255,255,255,0.10)',
                  backgroundColor: 'rgba(255,255,255,0.04)',
                  p: 0.5,
                  '& .MuiTabs-flexContainer': { gap: 0.5 },
                  '& .MuiTab-root': {
                    minHeight: 36,
                    borderRadius: 2.5,
                    fontWeight: 700,
                    color: 'rgba(255,255,255,0.75)'
                  },
                  '& .Mui-selected': {
                    color: '#fff'
                  }
                }}
                TabIndicatorProps={{ style: { display: 'none' } }}
              >
                <Tab value="login" label="Sign in" />
                <Tab value="register" label="Create account" />
              </Tabs>

              {error && <Alert severity="error">{error}</Alert>}

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button startIcon={<GoogleIcon />} size="large" variant="outlined" onClick={() => oauthLogin('google')} sx={{ flex: 1 }}>
                  Google
                </Button>
                <Button startIcon={<GitHubIcon />} size="large" variant="outlined" onClick={() => oauthLogin('github')} sx={{ flex: 1 }}>
                  GitHub
                </Button>
              </Stack>

              <Divider>or</Divider>

              <Stack spacing={2}>
                <TextField label="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
                <TextField label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
                {mode === 'register' && (
                  <TextField label="Display name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} autoComplete="nickname" />
                )}

                {mode === 'login' ? (
                  <Button size="large" variant="contained" disabled={loading} onClick={onPasswordLogin}>
                    Sign in
                  </Button>
                ) : (
                  <Button size="large" variant="contained" disabled={loading} onClick={onPasswordRegister}>
                    Create account
                  </Button>
                )}

                <Typography variant="body2" color="text.secondary">
                  Продолжая, вы соглашаетесь с
                  {' '}
                  <Link component={RouterLink} to="/terms" underline="hover">Terms</Link>
                  {' '}
                  и
                  {' '}
                  <Link component={RouterLink} to="/privacy" underline="hover">Privacy Policy</Link>.
                </Typography>
              </Stack>
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </Box>
  )
}
