import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, AlertBanner, Spinner } from '@neo-open-source/ui-web'
import { getAccessToken } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import Modal from '../components/Modal'
import { adminCreateClient, adminDeleteClient, adminListClients, adminUpdateClient, getProfile } from '../api/endpoints'
import styles from '../styles/ServicesPage.module.css'

interface Client { site_id?: string; client_id?: string; name: string; domain?: string; redirect_uris?: string[]; redirect_uri?: string; logo_url?: string }

function MonoField({ label, value, secret }: { label: string; value: string; secret?: boolean }) {
  const [revealed, setRevealed] = useState(false)
  const [copied, setCopied] = useState(false)
  return (
    <div>
      <span className={styles.monoLabel}>{label}</span>
      <div className={styles.monoWrap}>
        <code className={styles.monoCode}>{secret && !revealed ? '••••••••••••••••' : value}</code>
        {secret && <button className={styles.textButton} onClick={() => setRevealed(r => !r)}>{revealed ? 'Hide' : 'Show'}</button>}
        <button onClick={() => { navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }}
          className={styles.copyButton}>
          {copied ? '✓' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function ClientCard({ client, onEdit, onDelete }: { client: Client; onEdit: (c: Client) => void; onDelete: (c: Client) => void }) {
  const [expanded, setExpanded] = useState(false)
  const id = client.site_id || client.client_id || ''
  const uris = client.redirect_uris || (client.redirect_uri ? [client.redirect_uri] : [])
  return (
    <div className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardMain}>
          <p className={styles.cardName}>{client.name}</p>
          <p className={styles.cardDomain}>{client.domain}</p>
        </div>
        <div className={styles.cardActions}>
          <Button variant="secondary" size="sm" onClick={() => setExpanded(e => !e)}>{expanded ? 'Hide' : 'Details'}</Button>
          <Button variant="secondary" size="sm" onClick={() => onEdit(client)}>Edit</Button>
          <Button variant="danger" size="sm" onClick={() => onDelete(client)}>Delete</Button>
        </div>
      </div>
      {expanded && (
        <div className={styles.cardExpand}>
          <MonoField label="client_id" value={id} />
          <div>
            <span className={styles.monoLabel}>redirect_uris</span>
            <div className={styles.urisWrap}>
              {uris.map((uri, i) => <code key={i} className={styles.uriItem}>{uri}</code>)}
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
      <div className={styles.modalBody}>
        {error && <AlertBanner tone="danger" title={error} />}
        <Input placeholder="Name" value={name} onChange={e => setName(e.target.value)} autoFocus />
        <div>
          <label className={styles.fieldLabel}>Redirect URIs</label>
          <textarea value={redirectUris} onChange={e => setRedirectUris(e.target.value)} rows={3} className={styles.urisTextarea} />
          <p className={styles.fieldHint}>One URI per line</p>
        </div>
        <Input placeholder="Logo URL (optional)" value={logoUrl} onChange={e => setLogoUrl(e.target.value)} />
      </div>
    </Modal>
  )
}

export default function ServicesPage() {
  const navigate = useNavigate()
  const [accessLoading, setAccessLoading] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)

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
    try { const d = await adminListClients() as { clients?: Client[] }; setClients(d.clients || []) }
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
      <div className={styles.container}>
        {accessLoading ? (
          <div className={styles.accessLoading}>
            <Spinner />
          </div>
        ) : (
          <>
        {msg.text && <div className={styles.message}><AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} /></div>}
        <div className={styles.header}>
          <div>
            <h2 className={styles.title}>OIDC Clients</h2>
            <p className={styles.subtitle}>Manage your OpenID Connect clients</p>
          </div>
          <Button className={styles.newButton} size="sm" onClick={() => { setEditClient(null); setDialogOpen(true) }}>+ New client</Button>
        </div>
        {loading ? (
          <div className={styles.loading}>
            <Spinner />
          </div>
        )
          : clients.length === 0
            ? <div className={styles.empty}>
                <p className={styles.emptyText}>No OIDC clients yet</p>
                <Button variant="secondary" size="sm" onClick={() => { setEditClient(null); setDialogOpen(true) }}>Create your first client</Button>
              </div>
            : <div className={styles.list}>
                {clients.map(c => <ClientCard key={c.site_id || c.client_id} client={c} onEdit={c => { setEditClient(c); setDialogOpen(true) }} onDelete={onDelete} />)}
              </div>}
          </>
        )}
      </div>
      {dialogOpen && <ClientModal client={editClient} onClose={() => setDialogOpen(false)} onSaved={async () => { setDialogOpen(false); notify('success', editClient ? 'Updated' : 'Created'); await load() }} />}
    </ResponsiveLayout>
  )
}
