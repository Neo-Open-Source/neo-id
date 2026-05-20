import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, AlertBanner, Spinner, Avatar } from '@neo-open-source/ui-web'
import AuthShell from '../components/AuthShell'

const SCOPES: Record<string, string> = { openid: 'Your identity', profile: 'Name and avatar', email: 'Email address' }

export default function ConsentPage() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const sessionKey = params.get('session') || ''
  const [info, setInfo] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionKey) { navigate('/login'); return }
    fetch(`/api/oauth/consent-info?session=${encodeURIComponent(sessionKey)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then(setInfo).catch(() => setError('Session expired or invalid.')).finally(() => setLoading(false))
  }, [sessionKey, navigate])

  const respond = async (approved: boolean) => {
    setSubmitting(true); setError('')
    try {
      const token = (() => { try { return localStorage.getItem('accessToken') || '' } catch { return '' } })()
      const resp = await fetch('/api/oauth/consent', { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify({ session: sessionKey, approved }) })
      const data = await resp.json()
      if (!resp.ok) { setError(data.error || 'Something went wrong'); return }
      if (data.popup && data.access_token) {
        const msg = { type: 'neo_id_auth', access_token: data.access_token, refresh_token: data.refresh_token || '', state: data.state || '' }
        if (window.opener) { window.opener.postMessage(msg, data.origin || '*'); window.close() }
        else window.location.replace(data.redirect)
        return
      }
      if (data.redirect) window.location.replace(data.redirect)
    } catch { setError('Network error. Please try again.') }
    finally { setSubmitting(false) }
  }

  const site = info?.site as Record<string, string> | undefined
  const user = info?.user as Record<string, string> | undefined
  const scopes = (info?.scope as string)?.split(/[\s+]/).filter(s => SCOPES[s]) || []

  return (
    <AuthShell title="Allow access" description="Review the permissions before continuing." backTo="/login">
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}><Spinner /></div>
      ) : error && !info ? (
        <>
          <AlertBanner tone="danger" title={error} />
          <Button variant="secondary" onClick={() => navigate('/login')} style={{ width: '100%' }}>Back to sign in</Button>
        </>
      ) : (
        <>
          <div className="neo-id-consent-site">
            <Avatar className="neo-id-site-avatar" src={site?.logo || ''} fallback={(site?.name || '?')[0].toUpperCase()} />
            <div>
              <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>{site?.name || site?.id}</p>
              {site?.description && <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)' }}>{site.description}</p>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--neo-text-muted)' }}>
            <span>Signed in as</span>
            <span style={{ fontWeight: 600, color: 'var(--neo-text-primary)' }}>{user?.name || user?.email}</span>
          </div>
          <div style={{ display: 'grid', gap: 8 }}>
            <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neo-text-muted)', margin: 0 }}>This app will be able to access</p>
            {scopes.map(s => (
              <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14 }}>
                <span style={{ color: 'var(--neo-success-500)' }}>✓</span>{SCOPES[s]}
              </div>
            ))}
          </div>
          {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button disabled={submitting} onClick={() => respond(true)} style={{ width: '100%' }}>{submitting ? <Spinner /> : 'Allow'}</Button>
            <Button variant="secondary" disabled={submitting} onClick={() => respond(false)} style={{ width: '100%' }}>Deny</Button>
          </div>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', textAlign: 'center' }}>You can revoke access at any time from your Neo ID dashboard.</p>
        </>
      )}
      <style>{`
        .neo-id-consent-site {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px;
          border-radius: 18px;
          border: 1px solid var(--neo-border-subtle);
          background: var(--neo-surface-2);
        }
        .neo-id-site-avatar{width:40px;height:40px;border-radius:8px;}
        html[data-theme='light'] .neo-id-consent-site {
          background: #f4f5f7;
          border-color: #e4e8ee;
        }
      `}</style>
    </AuthShell>
  )
}
