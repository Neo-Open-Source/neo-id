import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, AlertBanner, Spinner } from '@neo-open-source/ui-web'
import { getAccessToken } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import Modal from '../components/Modal'
import { adminCreateClient, adminDeleteClient, adminListClients, adminUpdateClient, getProfile } from '../api/endpoints'

interface Client { site_id?: string; client_id?: string; name: string; domain?: string; redirect_uris?: string[]; redirect_uri?: string; logo_url?: string }

function MonoField({ label, value, secret, isMobile }: { label: string; value: string; secret?: boolean; isMobile?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <span style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neo-text-muted)' }}>{label}</span>
      <div style={{ display: 'flex', flexWrap: isMobile ? 'wrap' : 'nowrap', alignItems: 'center', gap: 8, background: 'var(--neo-surface-3)', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', padding: '6px 10px' }}>
        <code style={{ flex: 1, minWidth: isMobile ? '100%' : 0, fontSize: 13, wordBreak: 'break-all', fontFamily: 'monospace' }}>{secret && !revealed ? '••••••••••••••••' : value}</code>
        {secret && <button onClick={() => setRevealed(r => !r)} style={{ fontSize: 12, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neo-text-muted)', flexShrink: 0 }}>{revealed ? 'Hide' : 'Show'}</button>}
        <button onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
          style={{ fontSize: 12, background: 'none', border: '1px solid var(--neo-border-subtle)', borderRadius: 4, cursor: 'pointer', color: 'var(--neo-text-secondary)', padding: '2px 6px', flexShrink: 0 }}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function ClientCard({ client, onEdit, onDelete, isMobile }: { client: Client; onEdit: (c: Client) => void; onDelete: (c: Client) => void; isMobile?: boolean }) {
  const [expanded, setExpanded] = useState(false)
  const id = client.site_id || client.client_id || ''
  const uris = client.redirect_uris || (client.redirect_uri ? [client.redirect_uri] : [])
  return (
    <div style={{ border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-md)', padding: isMobile ? 14 : 20, background: 'var(--neo-surface-2)' }}>
      <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <p style={{ margin: 0, fontWeight: 600, fontSize: 14 }}>{client.name}</p>
          <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--neo-text-muted)' }}>{client.domain}</p>
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: isMobile ? 'stretch' : 'flex-end' }}>
          <Button variant="secondary" size="sm" onClick={() => setExpanded(e => !e)}>{expanded ? 'Hide' : 'Details'}</Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(client)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(client)}>Delete</Button>
        </div>
      </div>
      {expanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 16 }}>
          <MonoField label="client_id" value={id} isMobile={isMobile} />
          <div>
            <span style={{ display: 'block', marginBottom: 4, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neo-text-muted)' }}>redirect_uris</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {uris.map((uri, i) => <code key={i} style={{ fontSize: 12, background: 'var(--neo-surface-3)', border: '1px solid var(--neo-border-subtle)', borderRadius: 4, padding: '3px 8px', wordBreak: 'break-all' }}>{uri}</code>)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ClientModal({ client, onClose, onSaved }: { client: Client | null; onClose: () => void; onSaved: () => void }) {
  const isEdit = !!client
  const [name, setName] = useState(client?.name || '')
  const [redirectUris, setRedirectUris] = useState((client?.redirect_uris || (client?.redirect_uri ? [client.redirect_uri] : [])).join('\n'))
  const [logoUrl, setLogoUrl] = useState(client?.logo_url || '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const onSubmit = async () => {
    setError('')
    const uris = redirectUris.split('\n').map(s => s.trim()).filter(Boolean)
    if (!name.trim()) { setError('Name is required'); return }
    if (!uris.length) { setError('At least one redirect URI is required'); return }
    setLoading(true)
    try {
      if (isEdit) await adminUpdateClient(client!.site_id || client!.client_id || '', { name: name.trim(), redirect_uris: uris, logo_url: logoUrl })
      else await adminCreateClient({ name: name.trim(), redirect_uris: uris, logo_url: logoUrl })
      onSaved()
    } catch (e: unknown) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
    finally { setLoading(false) }
  }
  return (
    <Modal open onClose={onClose} title={isEdit ? 'Edit client' : 'Create client'}
      footer={<><Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button><Button size="sm" disabled={loading} onClick={onSubmit}>{loading ? 'Saving…' : isEdit ? 'Save' : 'Create'}</Button></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {error && <AlertBanner tone="danger" title={error} />}
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <div>
          <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 500 }}>Redirect URIs</label>
          <textarea value={redirectUris} onChange={e => setRedirectUris(e.target.value)} rows={3}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }} />
          <p style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--neo-text-muted)' }}>One URI per line</p>
        </div>
        <Input placeholder="Logo URL (optional)" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(false)
  const [accessLoading, setAccessLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  useEffect(() => { if (!getAccessToken()) navigate('/login') }, [navigate])
  useEffect(() => {
    setAccessLoading(true)
    getProfile().then(p => {
      if (!['developer', 'admin', 'moderator'].includes((p.role || '').toLowerCase())) navigate('/dashboard')
      else load().finally(() => setAccessLoading(false))
    }).catch(() => navigate('/login')).finally(() => setAccessLoading(false))
  }, [navigate])

  const notify = (type: string, text: string) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }
  const load = async () => {
    setLoading(true)
    try { const d = await adminListClients(); setClients(d.clients || []) }
    catch { notify('error', 'Failed to load clients') }
    finally { setLoading(false) }
  }
  const onDelete = async (client: Client) => {
    if (!window.confirm(`Delete "${client.name}"?`)) return
    try { await adminDeleteClient(client.site_id || client.client_id || ''); notify('success', 'Deleted'); await load() }
    catch (e: unknown) { notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  }

  return (
    <ResponsiveLayout 
      useAppLayout 
      appLayoutProps={{ title: "Neo ID", navItems: [{ label: '← Home', onClick: () => navigate('/') }] }}
      mobileTitle="Developer"
      backTo="/"
    >
      <div style={{ padding: isMobile ? 8 : 24, maxWidth: 760, width: '100%', boxSizing: 'border-box' }}>
        {accessLoading ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        ) : (
          <>
        {msg.text && <div style={{ marginBottom: 24 }}><AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} /></div>}
        <div style={{ display: 'flex', flexDirection: isMobile ? 'column' : 'row', justifyContent: 'space-between', alignItems: isMobile ? 'stretch' : 'center', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem' }}>OIDC Clients</h2>
            <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--neo-text-muted)' }}>Manage your OpenID Connect clients</p>
          </div>
          <Button size="sm" onClick={() => { setEditClient(null); setDialogOpen(true) }} style={{ width: isMobile ? '100%' : 'auto' }}>+ New client</Button>
        </div>
        {loading ? (
          <div style={{ minHeight: 140, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        )
          : clients.length === 0
            ? <div style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-md)', padding: 40, textAlign: 'center' }}>
                <p style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--neo-text-muted)' }}>No OIDC clients yet</p>
                <Button variant="secondary" size="sm" onClick={() => { setEditClient(null); setDialogOpen(true) }}>Create your first client</Button>
              </div>
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {clients.map(c => <ClientCard key={c.site_id || c.client_id} client={c} isMobile={isMobile} onEdit={c => { setEditClient(c); setDialogOpen(true) }} onDelete={onDelete} />)}
              </div>}
          </>
        )}
      </div>
      {dialogOpen && <ClientModal client={editClient} onClose={() => setDialogOpen(false)} onSaved={async () => { setDialogOpen(false); notify('success', editClient ? 'Updated' : 'Created'); await load() }} />}
    </ResponsiveLayout>
  )
}
