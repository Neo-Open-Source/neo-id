import { useEffect, useState } from 'react'
import { Box, Stack, Typography, Button, TextField, Alert, Collapse, Chip, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material'
import { registerService, getMyServices, deleteService, updateService } from '../../api/endpoints'

function SectionHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
    </Box>
  )
}

function Card({ children, sx = {} }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, ...sx }}>
      {children}
    </Box>
  )
}

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

function ServiceCard({ service, onDelete, onEdit, highlight }) {
  const [expanded, setExpanded] = useState(!!highlight)
  const envSnippet = `NEO_ID_URL=https://id.example.com\nNEO_ID_SITE_ID=${service.site_id}\nNEO_ID_API_KEY=${service.api_key || ''}`
  return (
    <Box sx={{ border: '1px solid', borderColor: highlight ? 'success.main' : 'divider', borderRadius: 2, p: 2, bgcolor: 'background.paper' }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" gap={1}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{service.name}</Typography>
          <Typography variant="caption" color="text.secondary">{service.domain}</Typography>
        </Box>
        <Stack direction="row" spacing={0.5} flexShrink={0}>
          <Button size="small" variant="outlined" onClick={() => setExpanded(e => !e)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            {expanded ? 'Hide' : 'Credentials'}
          </Button>
          <Button size="small" variant="outlined" onClick={() => onEdit(service)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            Edit
          </Button>
          <Button size="small" color="error" onClick={() => onDelete(service)} sx={{ fontSize: '0.75rem', height: 28, px: 1.25 }}>
            Delete
          </Button>
        </Stack>
      </Stack>

      <Collapse in={expanded}>
        <Stack spacing={1.5} sx={{ mt: 2 }}>
          {highlight && (
            <Alert severity="success" sx={{ py: 0.5, fontSize: '0.8rem' }}>
              Registered. Copy your credentials — the secret won't be shown again.
            </Alert>
          )}
          <MonoField label="NEO_ID_SITE_ID" value={service.site_id} />
          <MonoField label="NEO_ID_API_KEY" value={service.api_key || ''} secret={!highlight} />
          {(highlight || service.api_secret) && (
            <MonoField label="NEO_ID_API_SECRET" value={service.api_secret || ''} secret />
          )}
          <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 1.5 }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 0.75 }}>
              <Typography variant="caption" color="text.secondary"
                sx={{ fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>
                .env snippet
              </Typography>
              <CopyButton value={envSnippet} />
            </Stack>
            <Typography variant="caption" sx={{ fontFamily: 'monospace', fontSize: '0.75rem', whiteSpace: 'pre', display: 'block' }}>
              {envSnippet}
            </Typography>
          </Box>
        </Stack>
      </Collapse>
    </Box>
  )
}

function EditServiceDialog({ service, onClose, onSaved }) {
  const [origins, setOrigins] = useState((service?.allowed_origins || []).join('\n'))
  const [webhook, setWebhook] = useState(service?.webhook_url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    setError('')
    setLoading(true)
    try {
      await updateService({
        site_id: service.site_id,
        allowed_origins: origins.split('\n').map(s => s.trim()).filter(Boolean),
        webhook_url: webhook.trim() || undefined,
      })
      onSaved()
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 600, fontSize: '1rem' }}>Edit service — {service?.name}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 0.5 }}>
          {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
          <TextField
            label="Allowed origins"
            size="small"
            multiline
            minRows={4}
            value={origins}
            onChange={e => setOrigins(e.target.value)}
            helperText="One origin per line, e.g. https://example.com"
            autoFocus
          />
          <TextField
            label="Webhook URL (optional)"
            size="small"
            value={webhook}
            onChange={e => setWebhook(e.target.value)}
            placeholder="https://yourapp.com/webhooks/neo-id"
          />
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit} disabled={loading}>{loading ? 'Saving...' : 'Save'}</Button>
      </DialogActions>
    </Dialog>
  )
}

function RegisterForm({ onRegistered, notify }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [ownerEmail, setOwnerEmail] = useState('')
  const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onSubmit = async () => {
    setError('')
    if (!name.trim() || !domain.trim() || !ownerEmail.trim()) { setError('Name, domain and owner email are required'); return }
    setLoading(true)
    try {
      const data = await registerService({ name: name.trim(), domain: domain.trim(), owner_email: ownerEmail.trim(), webhook_url: webhookUrl.trim() || undefined })
      setOpen(false); setName(''); setDomain(''); setOwnerEmail(''); setWebhookUrl('')
      onRegistered(data.site)
    } catch (e) {
      setError(e?.response?.data?.error || e?.message || 'Failed')
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <Button variant="outlined" size="small" onClick={() => setOpen(true)} sx={{ alignSelf: 'flex-start' }}>
        + Register service
      </Button>
    )
  }

  return (
    <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 2.5 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, mb: 2 }}>Register new service</Typography>
      <Stack spacing={1.5}>
        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}
        <TextField label="Service name" size="small" value={name} onChange={e => setName(e.target.value)} placeholder="NeoMovies" autoFocus />
        <TextField label="Domain" size="small" value={domain} onChange={e => setDomain(e.target.value)} placeholder="api.example.com" />
        <TextField label="Owner email" size="small" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
        <TextField label="Webhook URL (optional)" size="small" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} placeholder="https://yourapp.com/webhooks/neo-id" />
        <Stack direction="row" spacing={1}>
          <Button variant="contained" size="small" onClick={onSubmit} disabled={loading} sx={{ px: 2 }}>
            {loading ? 'Registering...' : 'Register'}
          </Button>
          <Button size="small" onClick={() => { setOpen(false); setError('') }} sx={{ color: 'text.secondary' }}>Cancel</Button>
        </Stack>
      </Stack>
    </Box>
  )
}

export default function DeveloperSection({ profile, onNavigateToServices }) {
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [highlighted, setHighlighted] = useState(null)
  const [editService, setEditService] = useState(null) // newly registered service with full credentials

  const role = (profile?.role || '').toLowerCase()
  const canManageOidc = ['developer', 'admin', 'moderator'].includes(role)

  const loadServices = () => {
    getMyServices()
      .then(d => setServices(d.sites || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadServices() }, [])

  const onRegistered = (site) => {
    setHighlighted(site)
    setServices(prev => [site, ...prev.filter(s => s.site_id !== site.site_id)])
  }

  const onDelete = async (service) => {
    if (!window.confirm(`Delete "${service.name}"?`)) return
    try {
      await deleteService(service.site_id)
      setServices(prev => prev.filter(s => s.site_id !== service.site_id))
      if (highlighted?.site_id === service.site_id) setHighlighted(null)
    } catch {}
  }

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
        <SectionHeader title="Developer" subtitle="Registered services and OIDC clients" />
        {canManageOidc && (
          <Button variant="outlined" size="small" onClick={onNavigateToServices} sx={{ flexShrink: 0, mt: 0.5 }}>
            Manage OIDC Clients
          </Button>
        )}
      </Stack>

      <Stack spacing={2}>
        <RegisterForm onRegistered={onRegistered} />

        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading...</Typography>
        ) : services.length === 0 ? (
          <Card>
            <Typography variant="body2" color="text.secondary">No registered services yet</Typography>
          </Card>
        ) : (
          <Stack spacing={1.5}>
            {services.map(s => (
              <ServiceCard
                key={s.site_id}
                service={s}
                onDelete={onDelete}
                onEdit={setEditService}
                highlight={highlighted?.site_id === s.site_id}
              />
            ))}
          </Stack>
        )}
      </Stack>

      {editService && (
        <EditServiceDialog
          service={editService}
          onClose={() => setEditService(null)}
          onSaved={() => { setEditService(null); loadServices() }}
        />
      )}
    </Box>
  )
}
