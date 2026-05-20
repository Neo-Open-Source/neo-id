import { useEffect, useState } from 'react'
import { Button, Input, AlertBanner, Spinner } from '@neo-open-source/ui-web'
import { registerService, getMyServices, deleteService, updateService } from '../../api/endpoints'
import Modal from '../Modal'
import type { DeveloperService, UserProfile } from '../../types/app'

function MonoField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <span style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neo-text-muted)' }}>{label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--neo-surface-3)', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', padding: '6px 10px' }}>
        <code style={{ flex: 1, fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace' }}>{secret && !revealed ? '••••••••••••••••' : value}</code>
        {secret && <button onClick={() => setRevealed(r => !r)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neo-text-muted)', flexShrink: 0 }}>{revealed ? 'Hide' : 'Show'}</button>}
        <button onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
          style={{ fontSize: 12, background: 'none', border: '1px solid var(--neo-border-subtle)', borderRadius: 4, cursor: 'pointer', color: 'var(--neo-text-secondary)', padding: '2px 6px', flexShrink: 0 }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function ServiceCard({ service, onDelete, onEdit, highlight }: { service: DeveloperService; onDelete: (s: DeveloperService) => void; onEdit: (s: DeveloperService) => void; highlight?: boolean }) {
  const [expanded, setExpanded] = useState(!!highlight)
  const envSnippet = `NEO_ID_URL=https://id.example.com\nNEO_ID_SITE_ID=${service.site_id}\nNEO_ID_API_KEY=${service.api_key || ''}`
  return (
    <div style={{ border: `1px solid ${highlight ? 'var(--neo-success-500)' : 'var(--neo-border-subtle)'}`, borderRadius: 'var(--neo-radius-md)', padding: 20, background: 'var(--neo-surface-2)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{service.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--neo-text-muted)' }}>{service.domain}</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,minmax(0,1fr))', gap: 6, width: '100%' }}>
          <Button variant="secondary" size="sm" onClick={() => setExpanded(e => !e)} style={{ width: '100%' }}>{expanded ? 'Hide' : 'Credentials'}</Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(service)} style={{ width: '100%' }}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(service)} style={{ width: '100%' }}>Delete</Button>
        </div>
      </div>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          {highlight && <AlertBanner tone="success" title="Registered. Copy your credentials — the secret won't be shown again." />}
          <MonoField label="NEO_ID_SITE_ID" value={service.site_id} />
          <MonoField label="NEO_ID_API_KEY" value={service.api_key || ''} secret={!highlight} />
          {(highlight || service.api_secret) && <MonoField label="NEO_ID_API_SECRET" value={service.api_secret || ''} secret />}
          <div style={{ background: 'var(--neo-surface-3)', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', padding: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neo-text-muted)' }}>.env snippet</span>
              <button onClick={() => navigator.clipboard.writeText(envSnippet)} style={{ fontSize: 12, background: 'none', border: '1px solid var(--neo-border-subtle)', borderRadius: 4, cursor: 'pointer', color: 'var(--neo-text-secondary)', padding: '2px 6px' }}>Copy</button>
            </div>
            <pre style={{ margin: 0, fontSize: 13, fontFamily: 'monospace', whiteSpace: 'pre' }}>{envSnippet}</pre>
          </div>
        </div>
      )}
    </div>
  )
}

function EditModal({ service, onClose, onSaved }: { service: DeveloperService; onClose: () => void; onSaved: () => void }) {
  const [origins, setOrigins] = useState((service.allowed_origins || []).join('\n'))
  const [webhook, setWebhook] = useState(service.webhook_url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const onSubmit = async () => {
    setError(''); setLoading(true)
    try { await updateService({ site_id: service.site_id, allowed_origins: origins.split('\n').map(s => s.trim()).filter(Boolean), webhook_url: webhook.trim() || undefined }); onSaved() }
    catch (e: unknown) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }
  return (
    <Modal open onClose={onClose} title={`Edit — ${service.name}`}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={loading} onClick={onSubmit}>{loading ? 'Saving…' : 'Save'}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <AlertBanner tone="danger" title={error} />}
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Allowed origins</label>
          <textarea value={origins} onChange={e => setOrigins(e.target.value)} rows={4} autoFocus
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--neo-text-muted)' }}>One origin per line</p>
        </div>
        <Input placeholder="Webhook URL (optional)" value={webhook} onChange={e => setWebhook(e.target.value)} />
      </div>
    </Modal>
  )
}

function RegisterForm({ onRegistered }: { onRegistered: (s: DeveloperService) => void }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(''); const [domain, setDomain] = useState(''); const [ownerEmail, setOwnerEmail] = useState(''); const [webhookUrl, setWebhookUrl] = useState('')
  const [loading, setLoading] = useState(false); const [error, setError] = useState('')
  const onSubmit = async () => {
    setError('')
    if (!name.trim() || !domain.trim() || !ownerEmail.trim()) { setError('Name, domain and owner email are required'); return }
    setLoading(true)
    try {
      const data = await registerService({ name: name.trim(), domain: domain.trim(), owner_email: ownerEmail.trim(), webhook_url: webhookUrl.trim() || undefined }) as { site: DeveloperService }
      setOpen(false); setName(''); setDomain(''); setOwnerEmail(''); setWebhookUrl(''); onRegistered(data.site)
    } catch (e: unknown) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }
  if (!open) return <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>+ Register service</Button>
  return (
    <div style={{ background: 'var(--neo-surface-3)', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-md)', padding: 20 }}>
      <p style={{ margin: '0 0 16px', fontWeight: 600, fontSize: 14 }}>Register new service</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {error && <AlertBanner tone="danger" title={error} />}
        <Input placeholder="Service name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <Input placeholder="Domain" value={domain} onChange={e => setDomain(e.target.value)} />
        <Input placeholder="Owner email" value={ownerEmail} onChange={e => setOwnerEmail(e.target.value)} />
        <Input placeholder="Webhook URL (optional)" value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)} />
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="sm" disabled={loading} onClick={onSubmit}>{loading ? 'Registering…' : 'Register'}</Button>
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setError('') }}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}

export default function DeveloperSection({ profile, onNavigateToServices }: { profile?: Pick<UserProfile, 'role'>; onNavigateToServices?: () => void }) {
  const [services, setServices] = useState<DeveloperService[]>([])
  const [loading, setLoading] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [highlighted, setHighlighted] = useState<DeveloperService | null>(null)
  const [editService, setEditService] = useState<DeveloperService | null>(null)
  const canManageOidc = ['developer', 'admin', 'moderator'].includes((profile?.role || '').toLowerCase())
  const loadServices = () => { getMyServices().then(d => setServices(d.sites || [])).catch(() => {}).finally(() => setLoading(false)) }
  useEffect(() => { loadServices() }, [])
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])
  const onRegistered = (site: DeveloperService) => { setHighlighted(site); setServices(prev => [site, ...prev.filter(s => s.site_id !== site.site_id)]) }
  const onDelete = async (service: DeveloperService) => {
    if (!window.confirm(`Delete "${service.name}"?`)) return
    try { await deleteService(service.site_id); setServices(prev => prev.filter(s => s.site_id !== service.site_id)); if (highlighted?.site_id === service.site_id) setHighlighted(null) } catch {}
  }
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', marginBottom: 20, gap: 10, flexDirection: isMobile ? 'column' : 'row' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 700, fontSize: '1.3rem', letterSpacing: '-0.03em' }}>Developer</h2>
          <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--neo-text-muted)' }}>Registered services and OIDC clients</p>
        </div>
        {canManageOidc && <Button variant="secondary" size="sm" onClick={onNavigateToServices} style={{ alignSelf: isMobile ? 'stretch' : 'auto' }}>Manage OIDC Clients</Button>}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <RegisterForm onRegistered={onRegistered} />
        {loading ? (
          <div style={{ minHeight: 180, display: 'grid', placeItems: 'center', gap: 12 }}>
            <Spinner />
            <div style={{ width: '100%', maxWidth: 560, display: 'grid', gap: 10 }}>
              <div style={{ height: 76, borderRadius: 14, background: 'var(--neo-surface-2)' }} />
              <div style={{ height: 76, borderRadius: 14, background: 'var(--neo-surface-2)' }} />
            </div>
          </div>
        ) : services.length === 0
            ? <div style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 22, padding: 24 }}><p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>No registered services yet</p></div>
            : services.map(s => <ServiceCard key={s.site_id} service={s} onDelete={onDelete} onEdit={setEditService} highlight={highlighted?.site_id === s.site_id} />)}
      </div>
      {editService && <EditModal service={editService} onClose={() => setEditService(null)} onSaved={() => { setEditService(null); loadServices() }} />}
    </div>
  )
}
