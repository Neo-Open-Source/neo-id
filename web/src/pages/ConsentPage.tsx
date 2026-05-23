import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, AlertBanner, Spinner, Avatar } from '@neo-open-source/ui-web'
import AuthShell from '../components/AuthShell'
import styles from '../styles/ConsentPage.module.css'

const SCOPES: Record<string, string> = { openid: 'Your identity', profile: 'Name and avatar', email: 'Email address' }
type ConsentInfo = {
  site?: { id?: string; name?: string; description?: string; logo?: string }
  user?: { name?: string; email?: string }
  scope?: string
}

export default function ConsentPage() {
  const navigate = useNavigate()
  const params = new URLSearchParams(window.location.search)
  const sessionKey = params.get('session') || ''
  const [info, setInfo] = useState<ConsentInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!sessionKey) { navigate('/login'); return }
    fetch(`/api/oauth/consent-info?session=${encodeURIComponent(sessionKey)}`)
      .then(r => r.ok ? r.json() : Promise.reject(r.status))
      .then((data: ConsentInfo) => setInfo(data)).catch(() => setError('Session expired or invalid.')).finally(() => setLoading(false))
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

  const site = info?.site
  const user = info?.user
  const scopes = (info?.scope || '').split(/[\s+]/).filter(s => SCOPES[s]) || []

  return (
    <AuthShell title="Allow access" description="Review the permissions before continuing." backTo="/login" desktopSimple>
      {loading ? (
        <div className={styles.loadingWrap}><Spinner /></div>
      ) : error && !info ? (
        <>
          <AlertBanner tone="danger" title={error} />
          <Button className={styles.fullButton} variant="secondary" onClick={() => navigate('/login')}>Back to sign in</Button>
        </>
      ) : (
        <>
          <div className={styles.siteCard}>
            <Avatar className={styles.siteAvatar} src={site?.logo || ''} fallback={(site?.name || '?')[0].toUpperCase()} />
            <div>
              <p className={styles.siteName}>{site?.name || site?.id}</p>
              {site?.description && <p className={styles.siteDescription}>{site.description}</p>}
            </div>
          </div>
          <div className={styles.signedInRow}>
            <span>Signed in as</span>
            <span className={styles.signedInUser}>{user?.name || user?.email}</span>
          </div>
          <div className={styles.scopeWrap}>
            <p className={styles.scopeTitle}>This app will be able to access</p>
            {scopes.map(s => (
              <div key={s} className={styles.scopeItem}>
                <span className={styles.scopeMark}>✓</span>{SCOPES[s]}
              </div>
            ))}
          </div>
          {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
          <div className={styles.actions}>
            <Button className={styles.fullButton} disabled={submitting} onClick={() => respond(true)}>{submitting ? <Spinner /> : 'Allow'}</Button>
            <Button className={styles.fullButton} variant="secondary" disabled={submitting} onClick={() => respond(false)}>Deny</Button>
          </div>
          <p className={styles.note}>You can revoke access at any time from your Neo ID dashboard.</p>
        </>
      )}
    </AuthShell>
  )
}
