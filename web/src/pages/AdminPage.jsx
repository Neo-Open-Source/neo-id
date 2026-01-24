import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Container,
  Stack,
  Card,
  CardContent,
  Divider,
  Tabs,
  Tab,
  TextField,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Select,
  MenuItem
} from '@mui/material'

import { clearTokens } from '../api/client'
import {
  getProfile,
  adminGetUsers,
  adminSetUserRole,
  adminBanUser,
  adminUnbanUser,
  adminGetServices,
  adminCreateService,
  adminGetSites
} from '../api/endpoints'

function TabPanel({ value, index, children }) {
  if (value !== index) return null
  return children
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState(0)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const allowed = useMemo(() => {
    const role = (profile?.role || 'user').toLowerCase()
    return role === 'admin' || role === 'moderator'
  }, [profile])

  const logout = () => {
    clearTokens()
    navigate('/login')
  }

  // Users state
  const [users, setUsers] = useState([])
  const [usersSearch, setUsersSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersBannedOnly, setUsersBannedOnly] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLimit, setUsersLimit] = useState(20)
  const [usersPages, setUsersPages] = useState(1)

  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('permanent')

  // Services state
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [newService, setNewService] = useState({ name: '', display_name: '', description: '' })

  // Sites state
  const [sites, setSites] = useState([])
  const [sitesLoading, setSitesLoading] = useState(false)

  const loadProfile = async () => {
    const p = await getProfile()
    setProfile(p)
    return p
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await adminGetUsers({
        page: usersPage,
        limit: usersLimit,
        search: usersSearch || undefined,
        banned: usersBannedOnly ? 'true' : undefined
      })
      setUsers(res.users || [])
      const pages = res?.pagination?.pages || 1
      setUsersPages(pages)
    } finally {
      setUsersLoading(false)
    }
  }

  const loadServices = async () => {
    setServicesLoading(true)
    try {
      const res = await adminGetServices()
      setServices(res.services || [])
    } finally {
      setServicesLoading(false)
    }
  }

  const loadSites = async () => {
    setSitesLoading(true)
    try {
      const res = await adminGetSites()
      setSites(res.sites || [])
    } finally {
      setSitesLoading(false)
    }
  }

  useEffect(() => {
    loadProfile().catch(() => navigate('/login'))
  }, [])

  useEffect(() => {
    if (!allowed) return
    if (tab === 0) {
      loadUsers().catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load users'))
    } else if (tab === 1) {
      loadServices().catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load services'))
    } else {
      loadSites().catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load sites'))
    }
  }, [allowed, tab])

  useEffect(() => {
    if (!allowed) return
    if (tab !== 0) return
    loadUsers().catch((e) => setError(e?.response?.data?.error || e?.message || 'Failed to load users'))
  }, [allowed, tab, usersPage, usersLimit, usersBannedOnly])

  const onChangeRole = async (user_id, role) => {
    setError('')
    setInfo('')
    try {
      await adminSetUserRole(user_id, role)
      setInfo('Role updated')
      await loadUsers()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to update role')
    }
  }

  const openBanDialog = (user_id) => {
    setBanUserId(user_id)
    setBanReason('')
    setBanDuration('permanent')
    setBanDialogOpen(true)
  }

  const confirmBan = async () => {
    setError('')
    setInfo('')
    if (!banUserId) return
    if (!banReason.trim()) {
      setError('Ban reason is required')
      return
    }
    try {
      await adminBanUser(banUserId, banReason.trim(), banDuration)
      setInfo('User banned')
      setBanDialogOpen(false)
      await loadUsers()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to ban user')
    }
  }

  const onUnban = async (user_id) => {
    setError('')
    setInfo('')
    try {
      await adminUnbanUser(user_id)
      setInfo('User unbanned')
      await loadUsers()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to unban user')
    }
  }

  const onCreateService = async () => {
    setError('')
    setInfo('')
    try {
      await adminCreateService({
        name: newService.name,
        display_name: newService.display_name,
        description: newService.description
      })
      setInfo('Service created')
      setNewService({ name: '', display_name: '', description: '' })
      await loadServices()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed to create service')
    }
  }

  return (
    <>
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar>
          <Typography sx={{ flexGrow: 1, fontWeight: 700 }} variant="h6">Neo ID Admin</Typography>
          <Button onClick={() => navigate('/dashboard')}>Dashboard</Button>
          <Button color="error" onClick={logout}>Logout</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Stack spacing={2}>
          {error && <Alert severity="error">{error}</Alert>}
          {info && <Alert severity="success">{info}</Alert>}

          {!allowed && (
            <Alert severity="warning">
              Admin/Moderator access required
            </Alert>
          )}

          {allowed && (
            <Card>
              <CardContent>
                <Tabs value={tab} onChange={(_, v) => setTab(v)}>
                  <Tab label="Users" />
                  <Tab label="Services" />
                  <Tab label="Sites" />
                </Tabs>
                <Divider sx={{ my: 2 }} />

                <TabPanel value={tab} index={0}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <TextField
                        label="Search"
                        value={usersSearch}
                        onChange={(e) => setUsersSearch(e.target.value)}
                        fullWidth
                      />
                      <FormControlLabel
                        control={<Checkbox checked={usersBannedOnly} onChange={(e) => { setUsersPage(1); setUsersBannedOnly(e.target.checked) }} />}
                        label="Banned only"
                      />
                      <Select
                        size="small"
                        value={usersLimit}
                        onChange={(e) => { setUsersPage(1); setUsersLimit(Number(e.target.value)) }}
                      >
                        <MenuItem value={10}>10</MenuItem>
                        <MenuItem value={20}>20</MenuItem>
                        <MenuItem value={50}>50</MenuItem>
                      </Select>
                      <Button variant="contained" disabled={usersLoading} onClick={() => { setUsersPage(1); loadUsers() }}>
                        Refresh
                      </Button>
                    </Stack>

                    <Stack direction="row" spacing={2} alignItems="center" justifyContent="flex-end">
                      <Typography color="text.secondary">Page {usersPage} / {usersPages}</Typography>
                      <Button disabled={usersLoading || usersPage <= 1} onClick={() => setUsersPage((p) => Math.max(1, p - 1))}>Prev</Button>
                      <Button disabled={usersLoading || usersPage >= usersPages} onClick={() => setUsersPage((p) => p + 1)}>Next</Button>
                    </Stack>

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Unified ID</TableCell>
                          <TableCell>Email</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Role</TableCell>
                          <TableCell>Banned</TableCell>
                          <TableCell align="right">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {users.map((u) => (
                          <TableRow key={u.unified_id}>
                            <TableCell>{u.unified_id}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>{u.display_name}</TableCell>
                            <TableCell>
                              <Select
                                size="small"
                                value={(u.role || 'User')}
                                onChange={(e) => onChangeRole(u.unified_id, e.target.value)}
                              >
                                <MenuItem value="User">User</MenuItem>
                                <MenuItem value="Developer">Developer</MenuItem>
                                <MenuItem value="Moderator">Moderator</MenuItem>
                                <MenuItem value="Admin">Admin</MenuItem>
                              </Select>
                            </TableCell>
                            <TableCell>{u.is_banned ? 'yes' : 'no'}</TableCell>
                            <TableCell align="right">
                              {!u.is_banned ? (
                                <Button color="error" onClick={() => openBanDialog(u.unified_id)}>Ban</Button>
                              ) : (
                                <Button onClick={() => onUnban(u.unified_id)}>Unban</Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {users.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={6}>No users</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Stack>
                </TabPanel>

                <TabPanel value={tab} index={2}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button variant="contained" disabled={sitesLoading} onClick={() => loadSites()}>
                        Refresh
                      </Button>
                    </Stack>

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Site ID</TableCell>
                          <TableCell>Name</TableCell>
                          <TableCell>Domain</TableCell>
                          <TableCell>Plan</TableCell>
                          <TableCell>Active</TableCell>
                          <TableCell>Owner</TableCell>
                          <TableCell>API Key</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {sites.map((s) => (
                          <TableRow key={s.site_id}>
                            <TableCell>{s.site_id}</TableCell>
                            <TableCell>{s.name}</TableCell>
                            <TableCell>{s.domain}</TableCell>
                            <TableCell>{s.plan}</TableCell>
                            <TableCell>{s.is_active ? 'yes' : 'no'}</TableCell>
                            <TableCell>{s.owner_email}</TableCell>
                            <TableCell>{s.api_key}</TableCell>
                          </TableRow>
                        ))}
                        {sites.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7}>No sites</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Stack>
                </TabPanel>

                <TabPanel value={tab} index={1}>
                  <Stack spacing={2}>
                    <Stack direction="row" spacing={2} alignItems="center">
                      <Button variant="contained" disabled={servicesLoading} onClick={() => loadServices()}>
                        Refresh
                      </Button>
                    </Stack>

                    <Card variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle1">Create service</Typography>
                        <Stack spacing={2} sx={{ mt: 2 }}>
                          <TextField label="Name" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                          <TextField label="Display name" value={newService.display_name} onChange={(e) => setNewService({ ...newService, display_name: e.target.value })} />
                          <TextField label="Description" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
                          <Button variant="contained" onClick={onCreateService}>Create</Button>
                        </Stack>
                      </CardContent>
                    </Card>

                    <Table size="small">
                      <TableHead>
                        <TableRow>
                          <TableCell>Name</TableCell>
                          <TableCell>Display name</TableCell>
                          <TableCell>Description</TableCell>
                          <TableCell>Active</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {services.map((s) => (
                          <TableRow key={s.name}>
                            <TableCell>{s.name}</TableCell>
                            <TableCell>{s.display_name}</TableCell>
                            <TableCell>{s.description}</TableCell>
                            <TableCell>{s.is_active ? 'yes' : 'no'}</TableCell>
                          </TableRow>
                        ))}
                        {services.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4}>No services</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </Stack>
                </TabPanel>
              </CardContent>
            </Card>
          )}

          <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Ban user</DialogTitle>
            <DialogContent>
              <Stack spacing={2} sx={{ mt: 1 }}>
                <TextField label="User ID" value={banUserId} disabled />
                <TextField label="Reason" value={banReason} onChange={(e) => setBanReason(e.target.value)} />
                <Select value={banDuration} onChange={(e) => setBanDuration(e.target.value)}>
                  <MenuItem value="permanent">Permanent</MenuItem>
                  <MenuItem value="168h">7 days</MenuItem>
                  <MenuItem value="720h">30 days</MenuItem>
                </Select>
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setBanDialogOpen(false)}>Cancel</Button>
              <Button color="error" variant="contained" onClick={confirmBan}>Ban</Button>
            </DialogActions>
          </Dialog>
        </Stack>
      </Container>
    </>
  )
}
