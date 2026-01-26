import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Stack,
  Grid,
  Card,
  CardContent,
  TextField,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material'

import LogoutIcon from '@mui/icons-material/Logout'
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings'
import AddBusinessIcon from '@mui/icons-material/AddBusiness'
import DeleteIcon from '@mui/icons-material/Delete'

import { clearTokens, getAccessToken } from '../api/client'
import {
  getProfile,
  getProviders,
  unlinkProvider,
  setPassword,
  getServices,
  connectService,
  disconnectService,
  listServiceApps,
  createServiceApp,
  revokeServiceApp,
  deleteServiceApp
  ,
  getMySites
} from '../api/endpoints'

export default function DashboardPage() {
  const navigate = useNavigate()
  const [token, setToken] = useState(() => getAccessToken())
  const [profile, setProfile] = useState(null)
  const [providers, setProviders] = useState([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState({ connected_services: [], available_services: [] })

  const [mySites, setMySites] = useState([])

  const [serviceApps, setServiceApps] = useState([])
  const [newServiceAppName, setNewServiceAppName] = useState('')
  const [issuedToken, setIssuedToken] = useState('')

  const [newPassword, setNewPassword] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')

  useEffect(() => {
    setToken(getAccessToken())
  }, [])

  useEffect(() => {
    if (!token) navigate('/login')
  }, [token, navigate])

  const load = async () => {
    const p = await getProfile()
    setProfile(p)
    const pr = await getProviders()
    setProviders(pr.oauth_providers || [])
    setHasPassword(!!pr.has_password)
    const s = await getServices()
    setServices(s)

    if ((p.role || '').toLowerCase() === 'developer' || (p.role || '').toLowerCase() === 'admin' || (p.role || '').toLowerCase() === 'moderator') {
      const apps = await listServiceApps()
      setServiceApps(apps.service_apps || [])

      const sitesRes = await getMySites()
      setMySites(sitesRes.sites || [])
    }
  }

  useEffect(() => {
    load().catch(() => navigate('/login'))
  }, [])

  const logout = () => {
    clearTokens()
    navigate('/login')
  }

  const linkProvider = (provider) => {
    const accessToken = getAccessToken()
    window.location.href = `/api/auth/login/${provider}?link=1&token=${encodeURIComponent(accessToken)}`
  }

  const onUnlink = async (provider) => {
    await unlinkProvider(provider)
    clearTokens()
    navigate('/login')
  }

  const onSetPassword = async () => {
    await setPassword(newPassword, currentPassword)
    setNewPassword('')
    setCurrentPassword('')
    await load()
  }

  const onConnectService = async (name) => {
    await connectService(name)
    await load()
  }

  const onDisconnectService = async (name) => {
    await disconnectService(name)
    await load()
  }

  const onCreateServiceApp = async () => {
    const data = await createServiceApp(newServiceAppName)
    setIssuedToken(data.token || '')
    setNewServiceAppName('')
    await load()
  }

  const onRevokeServiceApp = async (id) => {
    await revokeServiceApp(id)
    await load()
  }

  const onDeleteServiceApp = async (id) => {
    await deleteServiceApp(id)
    await load()
  }

  const onDeleteSite = async (siteId) => {
    if (!window.confirm('Are you sure you want to delete this site? This action cannot be undone.')) {
      return
    }
    try {
      const response = await fetch('/api/site/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ site_id: siteId })
      })
      if (!response.ok) {
        const err = await response.json()
        alert(err.error || 'Failed to delete site')
        return
      }
      await load()
    } catch (e) {
      alert('Failed to delete site')
    }
  }

  return (
    <>
      <AppBar position="sticky" color="transparent" elevation={0}>
        <Toolbar>
          <Typography sx={{ flexGrow: 1, fontWeight: 700 }} variant="h6">Neo ID</Typography>
          {['developer', 'admin', 'moderator'].includes((profile?.role || 'user').toLowerCase()) && (
            <Button startIcon={<AddBusinessIcon />} onClick={() => navigate('/register')}>Register Site</Button>
          )}
          {['admin', 'moderator'].includes((profile?.role || 'user').toLowerCase()) && (
            <Button startIcon={<AdminPanelSettingsIcon />} onClick={() => navigate('/admin')}>Admin</Button>
          )}
          <Button color="error" startIcon={<LogoutIcon />} onClick={logout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 3, sm: 4 } }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <Stack spacing={3}>
              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Profile</Typography>
                  <Divider sx={{ my: 2 }} />
                  <Stack spacing={2}>
                    <TextField label="Email" value={profile?.email || ''} disabled />
                    <TextField label="Display Name" value={profile?.display_name || ''} disabled />
                    <TextField label="Role" value={profile?.role || 'User'} disabled />
                  </Stack>
                </CardContent>
              </Card>

              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>OAuth & Password</Typography>
                  <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                    {hasPassword ? 'Password login enabled' : 'Set a password to be able to unlink all providers'}
                  </Typography>
                  <Divider sx={{ my: 2 }} />

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 2 }}>
                    <Button variant="outlined" onClick={() => linkProvider('google')}>Link Google</Button>
                    <Button variant="outlined" onClick={() => linkProvider('github')}>Link GitHub</Button>
                  </Stack>

                  <List dense>
                    {providers.map((p) => (
                      <ListItem key={p.provider} divider>
                        <ListItemText primary={p.provider} secondary={p.external_id} />
                        <ListItemSecondaryAction>
                          <Button color="error" onClick={() => onUnlink(p.provider)}>Unlink</Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                    {providers.length === 0 && (
                      <ListItem>
                        <ListItemText primary="No linked providers" />
                      </ListItem>
                    )}
                  </List>

                  <Divider sx={{ my: 2 }} />
                  <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>Update password</Typography>
                  <Stack spacing={2} sx={{ mt: 1 }}>
                    <TextField label="New password" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                    <TextField label="Current password (if already set)" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                    <Button variant="contained" onClick={onSetPassword}>Save password</Button>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>

          <Grid item xs={12} md={7}>
            <Stack spacing={3}>
              {['developer', 'admin', 'moderator'].includes((profile?.role || 'user').toLowerCase()) && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>My Sites</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                      Sites you registered in Neo ID
                    </Typography>
                    <Divider sx={{ my: 2 }} />

                    <List dense>
                      {mySites.map((s) => (
                        <ListItem key={s.site_id} divider>
                          <ListItemText
                            primary={`${s.name} (${s.domain})`}
                            secondary={`site_id: ${s.site_id} • plan: ${s.plan} • api_key: ${s.api_key} • api_secret: ${s.api_secret}`}
                          />
                          <ListItemSecondaryAction>
                            <Button color="error" startIcon={<DeleteIcon />} onClick={() => onDeleteSite(s.site_id)}>Delete</Button>
                          </ListItemSecondaryAction>
                        </ListItem>
                      ))}
                      {mySites.length === 0 && (
                        <ListItem><ListItemText primary="No sites yet" secondary="Use Register Site to create one" /></ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardContent>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>Connected Services</Typography>
                  <Divider sx={{ my: 2 }} />

                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Connected</Typography>
                  <List dense>
                    {(services.connected_services || []).map((s) => (
                      <ListItem key={s.name} divider>
                        <ListItemText primary={s.display_name || s.name} secondary={s.description} />
                        <ListItemSecondaryAction>
                          <Button color="error" onClick={() => onDisconnectService(s.name)}>Disconnect</Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                    {(services.connected_services || []).length === 0 && (
                      <ListItem><ListItemText primary="No services connected" /></ListItem>
                    )}
                  </List>

                  <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 600 }}>Available</Typography>
                  <List dense>
                    {(services.available_services || []).map((s) => (
                      <ListItem key={s.name} divider>
                        <ListItemText primary={s.display_name || s.name} secondary={s.description} />
                        <ListItemSecondaryAction>
                          <Button onClick={() => onConnectService(s.name)}>Connect</Button>
                        </ListItemSecondaryAction>
                      </ListItem>
                    ))}
                    {(services.available_services || []).length === 0 && (
                      <ListItem><ListItemText primary="No available services" /></ListItem>
                    )}
                  </List>
                </CardContent>
              </Card>

              {(profile?.role || '').toLowerCase() !== 'user' && (
                <Card>
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>Developer: Service Apps</Typography>
                    <Typography color="text.secondary" variant="body2" sx={{ mt: 0.5 }}>
                      Create a service token and use it in your service as Authorization Bearer token for /api/service/*
                    </Typography>
                    <Divider sx={{ my: 2 }} />

                    <Stack spacing={2}>
                      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                        <TextField label="Service/App name" value={newServiceAppName} onChange={(e) => setNewServiceAppName(e.target.value)} />
                        <Button variant="contained" onClick={onCreateServiceApp} sx={{ minWidth: 140 }}>Create</Button>
                      </Stack>

                      {issuedToken && (
                        <TextField label="Issued token (copy now)" value={issuedToken} InputProps={{ readOnly: true }} />
                      )}

                      <List dense>
                        {serviceApps.map((a) => (
                          <ListItem key={a.id} divider>
                            <ListItemText primary={a.name} secondary={`prefix: ${a.token_prefix}${a.revoked_at ? ' (revoked)' : ''}`} />
                            <ListItemSecondaryAction>
                              {!a.revoked_at && (
                                <Button color="error" onClick={() => onRevokeServiceApp(a.id)}>Revoke</Button>
                              )}
                              <Button color="error" onClick={() => onDeleteServiceApp(a.id)}>Delete</Button>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                        {serviceApps.length === 0 && (
                          <ListItem><ListItemText primary="No service apps yet" /></ListItem>
                        )}
                      </List>
                    </Stack>
                  </CardContent>
                </Card>
              )}
            </Stack>
          </Grid>
        </Grid>
      </Container>
    </>
  )
}
