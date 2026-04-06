import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, TextField, Alert, Collapse,
  Tabs, Tab, Select, MenuItem, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, FormControlLabel, Checkbox, Avatar
} from '@mui/material'
import { clearTokens } from '../api/client'
import AppLayout from '../components/AppLayout.jsx'
import {
  getProfile, adminGetUsers, adminSetUserRole, adminBanUser,
  adminUnbanUser, adminGetServices, adminCreateService, adminGetSites,
  logout,
} from '../api/endpoints'

const ROLE_COLORS = {
  admin: '#111111',
  moderator: '#555555',
  developer: '#2563eb',
  user: '#999999'
}

export default function AdminPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [tab, setTab] = useState(0)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const allowed = useMemo(() => {
    const role = (profile?.role || 'user').toLowerCase()
    return role === 'admin' || role === 'moderator'
  }, [profile])

  const notify = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const handleLogout = async () => { await logout(); clearTokens(); navigate('/login') }

  // Users
  const [users, setUsers] = useState([])
  const [usersSearch, setUsersSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersBannedOnly, setUsersBannedOnly] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersLimit] = useState(20)
  const [usersPages, setUsersPages] = useState(1)

  const [banDialogOpen, setBanDialogOpen] = useState(false)
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('permanent')

  // Services
  const [services, setServices] = useState([])
  const [newService, setNewService] = useState({ name: '', display_name: '', description: '' })

  // Sites
  const [registeredServices, setRegisteredServices] = useState([])

  const loadProfile = async () => {
    const p = await getProfile()
    setProfile(p)
    return p
  }

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const res = await adminGetUsers({ page: usersPage, limit: usersLimit, search: usersSearch || undefined, banned: usersBannedOnly ? 'true' : undefined })
      setUsers(res.users || [])
      setUsersPages(res?.pagination?.pages || 1)
    } finally {
      setUsersLoading(false)
    }
  }

  const loadServices = async () => {
    const res = await adminGetServices()
    setServices(res.services || [])
  }

  const loadRegisteredServices = async () => {
    const res = await adminGetSites()
    setRegisteredServices(res.sites || [])
  }

  useEffect(() => {
    loadProfile().catch(() => navigate('/login'))
  }, [])

  useEffect(() => {
    if (!allowed) return
    if (tab === 0) loadUsers().catch((e) => notify('error', e?.message || 'Failed'))
    else if (tab === 1) loadServices().catch((e) => notify('error', e?.message || 'Failed'))
    else loadRegisteredServices().catch((e) => notify('error', e?.message || 'Failed'))
  }, [allowed, tab])

  useEffect(() => {
    if (!allowed || tab !== 0) return
    loadUsers().catch((e) => notify('error', e?.message || 'Failed'))
  }, [usersPage, usersBannedOnly])

  const onChangeRole = async (user_id, role) => {
    try { await adminSetUserRole(user_id, role); notify('success', 'Role updated'); await loadUsers() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const confirmBan = async () => {
    if (!banReason.trim()) { notify('error', 'Reason is required'); return }
    try {
      await adminBanUser(banUserId, banReason.trim(), banDuration)
      notify('success', 'User banned')
      setBanDialogOpen(false)
      await loadUsers()
    } catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onUnban = async (user_id) => {
    try { await adminUnbanUser(user_id); notify('success', 'User unbanned'); await loadUsers() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onCreateService = async () => {
    try {
      await adminCreateService(newService)
      notify('success', 'Service created')
      setNewService({ name: '', display_name: '', description: '' })
      await loadServices()
    } catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onDeleteSite = async (siteId) => {
    if (!window.confirm('Delete this service?')) return
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/service/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ site_id: siteId })
      })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      notify('success', 'Service deleted')
      await loadRegisteredServices()
    } catch (e) { notify('error', e?.message || 'Failed') }
  }


  return (
    <AppLayout
      title="Neo ID"
      subtitle="Admin Panel"
      mobileTitle="Neo ID · Admin"
      navItems={[{ label: 'Dashboard', onClick: () => navigate('/dashboard') }]}
      onLogout={handleLogout}
    >
      <Box sx={{ p: { xs: 2, md: 4 } }}>
        <Collapse in={!!msg.text}>
          <Alert severity={msg.type || 'info'} sx={{ mb: 3, py: 0.5 }}>{msg.text}</Alert>
        </Collapse>

        {!allowed ? (
          <Alert severity="warning">Admin or Moderator access required</Alert>
        ) : (
          <Box>
            <Box sx={{ mb: 3 }}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Admin Panel</Typography>
            </Box>

            <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, overflow: 'hidden' }}>
              <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', px: 3 }}>
                <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 48 }}>
                  <Tab label="Users" sx={{ minHeight: 48, fontSize: '0.875rem' }} />
                  <Tab label="Services" sx={{ minHeight: 48, fontSize: '0.875rem' }} />
                  <Tab label="Registered services" sx={{ minHeight: 48, fontSize: '0.875rem' }} />
                </Tabs>
              </Box>

              <Box sx={{ p: { xs: 2, md: 3 } }}>
                {/* Users tab */}
                {tab === 0 && (
                  <Stack spacing={2}>
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
                      <TextField
                        placeholder="Search by email or name..."
                        size="small"
                        value={usersSearch}
                        onChange={(e) => setUsersSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
                        sx={{ flex: 1 }}
                      />
                      <Stack direction="row" spacing={1} alignItems="center">
                        <FormControlLabel
                          control={<Checkbox size="small" checked={usersBannedOnly} onChange={(e) => { setUsersPage(1); setUsersBannedOnly(e.target.checked) }} />}
                          label={<Typography variant="body2">Banned</Typography>}
                          sx={{ m: 0 }}
                        />
                        <Button variant="outlined" size="small" disabled={usersLoading} onClick={() => { setUsersPage(1); loadUsers() }}>
                          Search
                        </Button>
                      </Stack>
                    </Stack>

                    {/* Compact user rows */}
                    <Stack spacing={0}>
                      {users.map((u, i) => (
                        <Box
                          key={u.unified_id}
                          sx={{
                            display: 'flex', alignItems: 'center', gap: 1.5,
                            py: 1.25, px: 1,
                            borderBottom: i < users.length - 1 ? '1px solid' : 'none',
                            borderColor: 'divider',
                            borderRadius: i === 0 ? '8px 8px 0 0' : i === users.length - 1 ? '0 0 8px 8px' : 0,
                            '&:hover': { bgcolor: 'action.hover' },
                            transition: 'background 0.1s'
                          }}
                        >
                          {/* Avatar */}
                          <Avatar
                            src={u.avatar || ''}
                            imgProps={{ referrerPolicy: 'no-referrer', crossOrigin: 'anonymous' }}
                            sx={{ width: 32, height: 32, bgcolor: 'action.selected', fontSize: '0.75rem', color: 'text.primary', flexShrink: 0 }}
                          >
                            {(u.display_name || u.email || '?')[0].toUpperCase()}
                          </Avatar>

                          {/* Name + email */}
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }} noWrap>
                              {u.display_name || '—'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>
                              {u.email}
                            </Typography>
                          </Box>

                          {/* Status chip */}
                          <Box sx={{ flexShrink: 0, display: { xs: 'none', sm: 'block' } }}>
                            {u.is_banned
                              ? <Chip label="Banned" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'error.main', color: '#fff', borderRadius: 1 }} />
                              : <Chip label="Active" size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'success.main', color: '#fff', borderRadius: 1 }} />
                            }
                          </Box>

                          {/* Role select */}
                          <Select
                            size="small"
                            value={u.role || 'User'}
                            onChange={(e) => onChangeRole(u.unified_id, e.target.value)}
                            sx={{ fontSize: '0.75rem', height: 28, minWidth: 100, flexShrink: 0 }}
                          >
                            <MenuItem value="User">User</MenuItem>
                            <MenuItem value="Developer">Developer</MenuItem>
                            <MenuItem value="Moderator">Moderator</MenuItem>
                            <MenuItem value="Admin">Admin</MenuItem>
                          </Select>

                          {/* Ban/Unban */}
                          {!u.is_banned ? (
                            <Button
                              size="small" color="error"
                              onClick={() => { setBanUserId(u.unified_id); setBanReason(''); setBanDuration('permanent'); setBanDialogOpen(true) }}
                              sx={{ fontSize: '0.72rem', height: 28, flexShrink: 0, minWidth: 'auto', px: 1 }}
                            >
                              Ban
                            </Button>
                          ) : (
                            <Button
                              size="small"
                              onClick={() => onUnban(u.unified_id)}
                              sx={{ fontSize: '0.72rem', height: 28, flexShrink: 0, minWidth: 'auto', px: 1 }}
                            >
                              Unban
                            </Button>
                          )}
                        </Box>
                      ))}
                      {users.length === 0 && (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                          No users found
                        </Typography>
                      )}
                    </Stack>

                    <Stack direction="row" spacing={1} alignItems="center" justifyContent="flex-end">
                      <Typography variant="caption" color="text.secondary">Page {usersPage} / {usersPages}</Typography>
                      <Button size="small" variant="outlined" disabled={usersLoading || usersPage <= 1} onClick={() => setUsersPage((p) => Math.max(1, p - 1))}>Prev</Button>
                      <Button size="small" variant="outlined" disabled={usersLoading || usersPage >= usersPages} onClick={() => setUsersPage((p) => p + 1)}>Next</Button>
                    </Stack>
                  </Stack>
                )}
                {/* Services tab */}
                {tab === 1 && (
                  <Stack spacing={2}>
                    <Box sx={{ bgcolor: 'action.hover', borderRadius: 2, p: 2.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Create service</Typography>
                      <Stack spacing={1.5}>
                        <TextField label="Name" size="small" value={newService.name} onChange={(e) => setNewService({ ...newService, name: e.target.value })} />
                        <TextField label="Display name" size="small" value={newService.display_name} onChange={(e) => setNewService({ ...newService, display_name: e.target.value })} />
                        <TextField label="Description" size="small" value={newService.description} onChange={(e) => setNewService({ ...newService, description: e.target.value })} />
                        <Button variant="contained" size="small" onClick={onCreateService} sx={{ alignSelf: 'flex-start', px: 2 }}>Create</Button>
                      </Stack>
                    </Box>

                    <Stack spacing={0}>
                      {services.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No services</Typography>
                      ) : services.map((s, i) => (
                        <Box key={s.name} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, px: 1, borderBottom: i < services.length - 1 ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500, fontFamily: 'monospace', fontSize: '0.82rem' }}>{s.name}</Typography>
                            <Typography variant="caption" color="text.secondary">{s.display_name}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, display: { xs: 'none', md: 'block' } }}>{s.description}</Typography>
                          <Chip
                            label={s.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem', bgcolor: s.is_active ? 'success.main' : 'action.selected', color: s.is_active ? '#fff' : 'text.secondary', border: 'none', borderRadius: 1, flexShrink: 0 }}
                          />
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                )}

                {/* Sites tab */}
                {tab === 2 && (
                  <Stack spacing={2}>
                    <Stack direction="row" justifyContent="flex-end">
                      <Button variant="outlined" size="small" onClick={loadRegisteredServices}>Refresh</Button>
                    </Stack>

                    <Stack spacing={0}>
                      {registeredServices.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No registered services</Typography>
                      ) : registeredServices.map((s, i) => (
                        <Box key={s.site_id} sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 1.25, px: 1, borderBottom: i < registeredServices.length - 1 ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                          <Box sx={{ flex: 1.5, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 500 }} noWrap>{s.name}</Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block' }}>{s.domain}</Typography>
                          </Box>
                          <Typography variant="caption" color="text.secondary" sx={{ flex: 1, display: { xs: 'none', sm: 'block' } }} noWrap>{s.owner_email}</Typography>
                          <Chip label={s.plan} size="small" sx={{ height: 20, fontSize: '0.65rem', bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1, flexShrink: 0 }} />
                          <Chip
                            label={s.is_active ? 'Active' : 'Inactive'}
                            size="small"
                            sx={{ height: 20, fontSize: '0.65rem', bgcolor: s.is_active ? 'success.main' : 'action.selected', color: s.is_active ? '#fff' : 'text.secondary', border: 'none', borderRadius: 1, flexShrink: 0 }}
                          />
                          <Button size="small" color="error" onClick={() => onDeleteSite(s.site_id)} sx={{ fontSize: '0.72rem', height: 28, flexShrink: 0, minWidth: 'auto', px: 1 }}>
                            Delete
                          </Button>
                        </Box>
                      ))}
                    </Stack>
                  </Stack>
                )}
              </Box>
            </Box>
          </Box>
        )}

      {/* Ban dialog */}
      <Dialog open={banDialogOpen} onClose={() => setBanDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem', pb: 1 }}>Ban user</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <TextField label="Reason" size="small" value={banReason} onChange={(e) => setBanReason(e.target.value)} fullWidth />
            <Select size="small" value={banDuration} onChange={(e) => setBanDuration(e.target.value)} fullWidth>
              <MenuItem value="permanent">Permanent</MenuItem>
              <MenuItem value="168h">7 days</MenuItem>
              <MenuItem value="720h">30 days</MenuItem>
            </Select>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button size="small" onClick={() => setBanDialogOpen(false)}>Cancel</Button>
          <Button size="small" color="error" variant="contained" onClick={confirmBan}>Ban</Button>
        </DialogActions>
      </Dialog>
      </Box>
    </AppLayout>
  )
}
