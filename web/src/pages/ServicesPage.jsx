import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Box, Stack, Typography, Button, TextField, Alert, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Collapse
} from '@mui/material'
import { getProfile } from '../api/endpoints'
import { adminListClients, adminCreateClient, adminUpdateClient, adminDeleteClient } from '../api/endpoints'
import AppLayout from '../components/AppLayout.jsx'
import { getAccessToken } from '../api/client'

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <Button size="small" variant="outlined" onClick={copy}
      sx={{ fontSize: '0.72rem', height: 24, px: 1, flexShrink: 0, minWidth: 0 }}>
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

function ClientCard({ client, onEdit, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5, bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" gap={1}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{client.name}</Typography>
            {client.logo_url && (
              <Box component="img" src={client.logo_url} alt="" sx={{ width: 18, height: 18, borderRadius: 0.5, objectFit: 'contain' }} />
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">{client.domain}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexShrink={0}>
          <Button size="small" variant="outlined" onClick={() => setExpanded(e => !e)}
            sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            {expanded ? 'Hide' : 'Details'}
          </Button>
          <Button size="small" variant="outlined" onClick={() => onEdit(client)}
            sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            Edit
          </Button>
          <Button size="small" color="error" onClick={() => onDelete(client)}
            sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            Delete
          </Button>
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
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>
        {isEdit ? 'Edit client' : 'Create client'}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <TextField label="Name" size="small" value={name} onChange={e => setName(e.target.value)} autoFocus />
          <TextField
            label="Redirect URIs"
            size="small"
            multiline
            minRows={3}
            value={redirectUris}
            onChange={e => setRedirectUris(e.target.value)}
            helperText="One URI per line"
          />
          <TextField label="Logo URL (optional)" size="small" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading}>
          {loading ? 'Saving...' : isEdit ? 'Save' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  )
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState(null)
  const token = getAccessToken()

  useEffect(() => { if (!token) navigate('/login') }, [token, navigate])

  const load = async () => {
    setLoading(true)
    try {
      const data = await adminListClients()
      setClients(data.clients || [])
    } catch {
      notify('error', 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    getProfile().then(p => {
      const role = (p.role || '').toLowerCase()
      if (!['developer', 'admin', 'moderator'].includes(role)) {
        navigate('/dashboard')
      } else {
        load()
      }
    }).catch(() => navigate('/login'))
  }, [])

  const notify = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const onDelete = async (client) => {
    if (!window.confirm(`Delete "${client.name}"?`)) return
    try {
      await adminDeleteClient(client.site_id || client.client_id)
      notify('success', 'Client deleted')
      await load()
    } catch (e) {
      notify('error', e?.response?.data?.error || 'Failed to delete')
    }
  }

  const onEdit = (client) => { setEditClient(client); setDialogOpen(true) }
  const onCreate = () => { setEditClient(null); setDialogOpen(true) }
  const onDialogClose = () => setDialogOpen(false)
  const onSaved = async () => {
    setDialogOpen(false)
    notify('success', editClient ? 'Client updated' : 'Client created')
    await load()
  }

  const SidebarContent = ({ onClose }) => null // removed — using AppLayout

  return (
    <AppLayout
      title="Neo ID"
      navItems={[{ label: '← Dashboard', onClick: () => navigate('/dashboard') }]}
    >
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 760 }}>
        <Collapse in={!!msg.text}>
          <Alert severity={msg.type || 'info'} sx={{ mb: 3, py: 0.5 }}>{msg.text}</Alert>
        </Collapse>

        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Services</Typography>
            <Typography variant="body2" color="text.secondary">Manage your OIDC clients</Typography>
          </Box>
          <Button variant="contained" size="small" onClick={onCreate} sx={{ height: 34, px: 2 }}>
            + New client
          </Button>
        </Stack>

        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading...</Typography>
        ) : clients.length === 0 ? (
          <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No clients yet</Typography>
            <Button variant="outlined" size="small" onClick={onCreate}>Create your first client</Button>
          </Box>
        ) : (
          <Stack spacing={2}>
            {clients.map(c => (
              <ClientCard key={c.site_id || c.client_id} client={c} onEdit={onEdit} onDelete={onDelete} />
            ))}
          </Stack>
        )}
      </Box>

      <ClientDialog open={dialogOpen} client={editClient} onClose={onDialogClose} onSaved={onSaved} />
      </Box>
    </AppLayout>
  )
}
