import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, TextField, Alert, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Collapse, Tabs, Tab
} from '@mui/material'
import { getProfile, adminListClients, adminCreateClient, adminUpdateClient, adminDeleteClient, registerService, getMyServices, deleteService } from '../api/endpoints'
import AppLayout from '../components/AppLayout.jsx'
import { getAccessToken } from '../api/client'

// ── Shared helpers ──────────────────────────────────────────────────────────

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  return (
    <Button size="small" variant="outlined" onClick={() => {
      navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
    }} sx={{ fontSize: '0.72rem', height: 24, px: 1, flexShrink: 0, minWidth: 0 }}>
      {copied ? '✓' : 'Copy'}
    </Button>
  )
}

function MonoField({ label, value, secret }) {
  const [revealed, setRevealed] = useState(false)
  const display = secret && !revealed ? '••••••••••••••••' : value
  return (
    <Box>
      <Typography variant="caption" color="text.secondary"
        sx={{ display: 'block', mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
        {label}
      </Typography>
      <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, px: 1.5, py: 0.75, display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flex: 1, fontSize: '0.78rem' }}>
          {display}
        </Typography>
        {secret && (
          <Button size="small" onClick={() => setRevealed(r => !r)}
            sx={{ fontSize: '0.72rem', height: 24, px: 1, flexShrink: 0, minWidth: 0, color: 'text.secondary' }}>
            {revealed ? 'Hide' : 'Show'}
          </Button>
        )}
        <CopyButton value={value} />
      </Box>
    </Box>
  )
}

// ── OIDC Clients ─────────────────────────────────────────────────────────────

function ClientCard({ client, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{client.name}</Typography>
          <Typography variant="caption" color="text.secondary">{client.domain}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexShrink={0}>
          <Button size="small" variant="outlined" onClick={() => setExpanded(e => !e)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            {expanded ? 'Hide' : 'Details'}
          </Button>
          <Button size="small" variant="outlined" onClick={() => onEdit(client)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>Edit</Button>
          <Button size="small" color="error" onClick={() => onDelete(client)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>Delete</Button>
        </Stack>
      </Stack>
      <Collapse in={expanded}>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          <MonoField label="client_id" value={client.site_id || client.client_id || ''} />
          <MonoField label="client_secret" value={client.api_secret || ''} secret />
          <Box>
            <Typography variant="caption" color="text.secondary"
              sx={{ display: 'block', mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
              redirect_uris
            </Typography>
            <Stack spacing={0.5}>
              {(client.redirect_uris || (client.redirect_uri ? [client.redirect_uri] : [])).map((uri, i) => (
                <Chip key={i} label={uri} size="small"
                  sx={{ fontFamily: 'monospace', fontSize: '0.72rem', height: 'auto', py: 0.25, borderRadius: 1, bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', '& .MuiChip-label': { whiteSpace: 'normal', wordBreak: 'break-all' } }} />
              ))}
            </Stack>
          </Box>
        </Stack>
      </Collapse>
    </Box>
  )
}

function ClientDialog({ open, client, onClose, onSaved }) {
  const isEdit = !!client
  const [name, setName] = useState('')
  const [redirectUris, setRedirectUris] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) {
      setName(client?.name || '')
      setRedirectUris((client?.redirect_uris || (client?.redirect_uri ? [client.redirect_uri] : [])).join('\n'))
      setLogoUrl(client?.logo_url || '')
      setError('')
    }
  }, [open, client])

  const onSubmit = async () => {
    setError('')
    const uris = redirectUris.split('\n').map(s => s.trim()).filter(Boolean)
    if (!name.trim()) { setError('Name is required'); return }
    if (uris.length === 0) { setError('At least one redirect URI is required'); return }
    setLoading(true)
    try {
      if (isEdit) {
        await adminUpdateClient(client.site_id || client.client_id, { name: name.trim(), redirect_uris: uris, logo_url: logoUrl })
      } else {
        await adminCreateClient({ name: name.trim(), redirect_uris: uris, logo_url: logoUrl })
      }
      onSaved()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>{isEdit ? 'Edit client' : 'Create client'}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <TextField label="Name" size="small" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <TextField label="Redirect URIs" size="small" multiline minRows={3} value={redirectUris} onChange={e => setRedirectUris(e.target.value)} helperText="One URI per line" />
          <TextField label="Logo URL (optional)" size="small" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading}>{loading ? 'Saving...' : isEdit ? 'Save' : 'Create'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Registered Services ───────────────────────────────────────────────────────

function ServiceCard({ service, onDelete, newCredentials }) {
  const [expanded, setExpanded] = useState(!!newCredentials)
  return (
    <Box sx={{ border: '1px solid', borderColor: newCredentials ? 'success.main' : 'divider', borderRadius: 2, p: 2.5, bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{service.name}</Typography>
          <Typography variant="caption" color="text.secondary">{service.domain}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexShrink={0}>
          <Button size="small" variant="outlined" onClick={() => setExpanded(e => !e)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            {expanded ? 'Hide' : 'Credentials'}
          </Button>
          <Button size="small" color="error" onClick={() => onDelete(service)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>Delete</Button>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {newCredentials && (
            <Alert severity="success" sx={{ py: 0.5, fontSize: '0.8rem' }}>
              Service registered. Copy your credentials — the secret won't be shown again.
            </Alert>
          )}
          <MonoField label="NEO_ID_SITE_ID" value={service.site_id || newCredentials?.site_id || ''} />
          <MonoField label="NEO_ID_API_KEY" value={service.api_key || newCredentials?.api_key || ''} secret={!newCredentials} />
          <MonoField label="NEO_ID_API_SECRET" value={newCredentials?.api_secret || service.api_secret || ''} secret />
          <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
              .env snippet
            </Typography>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre', display: 'block' }}>
              {`NEO_ID_URL=https://id.neomovies.ru\nNEO_ID_SITE_ID=${service.site_id || newCredentials?.site_id || ''}\nNEO_ID_API_KEY=${service.api_key || newCredentials?.api_key || ''}`}
            </Typography>
            <CopyButton value={`NEO_ID_URL=https://id.neomovies.ru\nNEO_ID_SITE_ID=${service.site_id || newCredentials?.site_id || ''}\nNEO_ID_API_KEY=${service.api_key || newCredentials?.api_key || ''}`} />
          </Box>
        </Stack>
      </Collapse>
    </Box>
  )
}

function RegisterServiceDialog({ open, onClose, onSaved }) {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [description, setDescription] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (open) { setName(''); setDomain(''); setDescription(''); setOwnerEmail(''); setWebhookUrl(''); setError('') }
  }, [open])

  const onSubmit = async () => {
    setError('')
    if (!name.trim() || !domain.trim() || !ownerEmail.trim()) {
      setError('Name, domain, and owner email are required')
      return
    }
    setLoading(true)
    try {
      const data = await registerService({
        name: name.trim(),
        domain: domain.trim(),
        description: description.trim(),
        owner_email: ownerEmail.trim(),
        webhook_url: webhookUrl.trim() || undefined,
      })
      onSaved(data.site)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>Register service</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <TextField label="Service name" size="small" value={name} onChange={e => setName(e.target.value)} autoFocus placeholder="NeoMovies" />
          <TextField label="Domain" size="small" value={domain} onChange={e => setDomain(e.target.value)} placeholder="api.neomovies.ru" helperText="Primary domain of your service" />
          <TextField label="Owner email" size="small" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} placeholder="you@example.com" />
          <TextField label="Description (optional)" size="small" value={description} onChange={e => setDescription(e.target.value)} />
          <TextField label="Webhook URL (optional)" size="small" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://yourapp.com/webhooks/neo-id" helperText="Called when a user disconnects your service" />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading}>{loading ? 'Registering...' : 'Register'}</Button>
      </DialogActions>
    </Dialog>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ServicesPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(0)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const token = getAccessToken()

  // OIDC clients
  const [clients, setClients] = useState([])
  const [clientsLoading, setClientsLoading] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState(null)

  // Registered services
  const [services, setServices] = useState([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [registerOpen, setRegisterOpen] = useState(false)
  const [newCredentials, setNewCredentials] = useState(null) // { site_id, api_key, api_secret }

  useEffect(() => { if (!token) navigate('/login') }, [token, navigate])

  useEffect(() => {
    getProfile().then(p => {
      const role = (p.role || '').toLowerCase()
      if (!['developer', 'admin', 'moderator'].includes(role)) navigate('/dashboard')
      else { loadClients(); loadServices() }
    }).catch(() => navigate('/login'))
  }, [])

  const notify = (type, text) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }

  const loadClients = async () => {
    setClientsLoading(true)
    try { const d = await adminListClients(); setClients(d.clients || []) }
    catch { notify('error', 'Failed to load clients') }
    finally { setClientsLoading(false) }
  }

  const loadServices = async () => {
    setServicesLoading(true)
    try { const d = await getMyServices(); setServices(d.sites || []) }
    catch { notify('error', 'Failed to load services') }
    finally { setServicesLoading(false) }
  }

  const onDeleteClient = async (client) => {
    if (!window.confirm(`Delete "${client.name}"?`)) return
    try { await adminDeleteClient(client.site_id || client.client_id); notify('success', 'Deleted'); await loadClients() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onDeleteService = async (service) => {
    if (!window.confirm(`Delete "${service.name}"?`)) return
    try { await deleteService(service.site_id); notify('success', 'Service deleted'); await loadServices() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onServiceRegistered = (site) => {
    setRegisterOpen(false)
    setNewCredentials(site)
    loadServices()
  }

  return (
    <AppLayout title="Neo ID" navItems={[{ label: '← Dashboard', onClick: () => navigate('/dashboard') }]}>
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 760 }}>
        <Collapse in={!!msg.text}>
          <Alert severity={msg.type || 'info'} sx={{ mb: 3, py: 0.5 }}>{msg.text}</Alert>
        </Collapse>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Developer</Typography>
            <Typography variant="body2" color="text.secondary">Manage OIDC clients and registered services</Typography>
          </Box>
          {tab === 0 && (
            <Button variant="contained" size="small" onClick={() => { setEditClient(null); setDialogOpen(true) }} sx={{ height: 34, px: 2 }}>
              + New client
            </Button>
          )}
          {tab === 1 && (
            <Button variant="contained" size="small" onClick={() => setRegisterOpen(true)} sx={{ height: 34, px: 2 }}>
              + Register service
            </Button>
          )}
        </Stack>

        <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', mb: 3 }}>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ minHeight: 40 }}>
            <Tab label="OIDC Clients" sx={{ minHeight: 40, fontSize: '0.875rem' }} />
            <Tab label="Registered Services" sx={{ minHeight: 40, fontSize: '0.875rem' }} />
          </Tabs>
        </Box>

        {/* OIDC Clients */}
        {tab === 0 && (
          clientsLoading ? <Typography variant="body2" color="text.secondary">Loading...</Typography>
          : clients.length === 0 ? (
            <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No OIDC clients yet</Typography>
              <Button variant="outlined" size="small" onClick={() => { setEditClient(null); setDialogOpen(true) }}>Create your first client</Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              {clients.map(c => (
                <ClientCard key={c.site_id || c.client_id} client={c} onEdit={c => { setEditClient(c); setDialogOpen(true) }} onDelete={onDeleteClient} />
              ))}
            </Stack>
          )
        )}

        {/* Registered Services */}
        {tab === 1 && (
          servicesLoading ? <Typography variant="body2" color="text.secondary">Loading...</Typography>
          : services.length === 0 && !newCredentials ? (
            <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>No registered services yet</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                Register a service to get an API key for the simple token-based auth flow
              </Typography>
              <Button variant="outlined" size="small" onClick={() => setRegisterOpen(true)}>Register your first service</Button>
            </Box>
          ) : (
            <Stack spacing={2}>
              {newCredentials && (
                <ServiceCard
                  service={newCredentials}
                  onDelete={onDeleteService}
                  newCredentials={newCredentials}
                />
              )}
              {services.filter(s => s.site_id !== newCredentials?.site_id).map(s => (
                <ServiceCard key={s.site_id} service={s} onDelete={onDeleteService} newCredentials={null} />
              ))}
            </Stack>
          )
        )}
      </Box>

      <ClientDialog open={dialogOpen} client={editClient} onClose={() => setDialogOpen(false)}
        onSaved={async () => { setDialogOpen(false); notify('success', editClient ? 'Updated' : 'Created'); await loadClients() }} />

      <RegisterServiceDialog open={registerOpen} onClose={() => setRegisterOpen(false)} onSaved={onServiceRegistered} />
    </AppLayout>
  )
}
