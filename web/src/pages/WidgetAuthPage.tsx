import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { AlertBanner, Button, Spinner } from '@neo-open-source/ui-web'
import styles from '../styles/WidgetAuthPage.module.css'

const POLL_INTERVAL = 3000
const CODE_TTL = 5 * 60 * 1000

type Status = 'idle' | 'waiting' | 'confirmed' | 'expired'

export default function WidgetAuthPage() {
  const [code, setCode] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [tokens, setTokens] = useState<{ access_token?: string; refresh_token?: string }>({})
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = () => {
    if (pollRef.current) clearInterval(pollRef.current)
    if (expiryRef.current) clearTimeout(expiryRef.current)
  }

  const generateCode = async () => {
    clearTimers()
    setError('')
    setStatus('idle')
    setTokens({})
    try {
      const resp = await fetch('/api/device/code', { method: 'POST' })
      if (!resp.ok) throw new Error('Failed to generate code')
      const data = await resp.json()
      const userCode = String(data.user_code || '')
      const deviceCode = String(data.device_code || '')
      setCode(userCode)

      const url = `${window.location.origin}/tv?code=${encodeURIComponent(userCode)}`
      const qr = await QRCode.toDataURL(url, { width: 220, margin: 1 })
      setQrImage(qr)
      setStatus('waiting')

      pollRef.current = setInterval(async () => {
        try {
          const pr = await fetch('/api/device/poll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ device_code: deviceCode }),
          })
          const pd = await pr.json()
          if (pd.status === 'confirmed' && pd.access_token) {
            clearTimers()
            setStatus('confirmed')
            setTokens({ access_token: pd.access_token, refresh_token: pd.refresh_token })
            // For embedded mode: notify parent.
            window.parent?.postMessage({
              type: 'neo_id_widget_auth',
              status: 'confirmed',
              access_token: pd.access_token,
              refresh_token: pd.refresh_token,
            }, '*')
          } else if (pd.status === 'expired') {
            clearTimers()
            setStatus('expired')
          }
        } catch {
          // keep polling until ttl
        }
      }, POLL_INTERVAL)

      expiryRef.current = setTimeout(() => {
        clearTimers()
        setStatus('expired')
      }, CODE_TTL)
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || 'Failed to generate code')
      setStatus('idle')
    }
  }

  useEffect(() => {
    generateCode()
    return clearTimers
  }, [])

  const formattedCode = code ? `${code.slice(0, 3)}-${code.slice(3)}` : ''

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Sign in with Neo ID</h1>
        <p className={styles.subtitle}>Scan QR or enter code at <strong>neo.id/tv</strong></p>

        {error ? <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} /> : null}

        {status === 'idle' ? (
          <div className={styles.center}><Spinner /></div>
        ) : (
          <>
            {qrImage ? <img className={styles.qr} src={qrImage} alt="Neo ID QR code" /> : null}
            <div className={styles.code}>{formattedCode}</div>
          </>
        )}

        {status === 'waiting' ? <p className={styles.waiting}>Waiting for confirmation…</p> : null}
        {status === 'confirmed' ? <AlertBanner tone="success" title="Connected successfully" /> : null}
        {status === 'expired' ? <AlertBanner tone="warning" title="Code expired. Generate a new one." /> : null}

        <div className={styles.actions}>
          <Button variant="secondary" onClick={generateCode}>Refresh code</Button>
        </div>

        {/* Debug / direct mode support */}
        {status === 'confirmed' && tokens.access_token ? (
          <details className={styles.debug}>
            <summary>Integration payload</summary>
            <pre>{JSON.stringify({ type: 'neo_id_widget_auth', status, ...tokens }, null, 2)}</pre>
          </details>
        ) : null}
      </div>
    </div>
  )
}

