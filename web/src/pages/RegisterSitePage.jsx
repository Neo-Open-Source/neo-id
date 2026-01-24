import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AppBar, Toolbar, Typography, Button, Container, Stack, TextField, Card, CardContent, Alert } from '@mui/material'
import { getProfile, registerSite } from '../api/endpoints'

export default function RegisterSitePage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    name: '',
    domain: '',
    description: '',
    logo_url: '',
    owner_email: '',
    plan: 'free'
  })
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    getProfile()
      .then((p) => {
        const role = (p.role || 'user').toLowerCase()
        setAllowed(['developer', 'admin', 'moderator'].includes(role))
        if (!['developer', 'admin', 'moderator'].includes(role)) {
          setError('Developer role required')
        }
      })
      .catch(() => {
        setError('Unauthorized')
        setAllowed(false)
      })
  }, [])

  const onChange = (key) => (e) => setForm({ ...form, [key]: e.target.value })

  const onSubmit = async () => {
    if (!allowed) {
      return
    }
    setError('')
    try {
      const data = await registerSite(form)
      setResult(data)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to register')
    }
  }

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography sx={{ flexGrow: 1 }} variant="h6">Register Site</Typography>
          <Button onClick={() => navigate('/dashboard')}>Back</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="sm" sx={{ py: 4 }}>
        <Stack spacing={3}>
          {error && <Alert severity="error">{error}</Alert>}

          <Card>
            <CardContent>
              <Stack spacing={2}>
                <TextField label="Site name" value={form.name} onChange={onChange('name')} disabled={!allowed} />
                <TextField label="Domain" value={form.domain} onChange={onChange('domain')} disabled={!allowed} />
                <TextField label="Owner email" value={form.owner_email} onChange={onChange('owner_email')} disabled={!allowed} />
                <TextField label="Description" value={form.description} onChange={onChange('description')} disabled={!allowed} />
                <TextField label="Logo URL" value={form.logo_url} onChange={onChange('logo_url')} disabled={!allowed} />
                <Button variant="contained" disabled={!allowed} onClick={onSubmit}>Register</Button>
              </Stack>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardContent>
                <Typography variant="h6">Result</Typography>
                <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(result, null, 2)}</pre>
              </CardContent>
            </Card>
          )}
        </Stack>
      </Container>
    </>
  )
}
