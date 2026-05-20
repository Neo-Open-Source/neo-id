import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import QRCode from 'qrcode'
import {
  Button,
  Card, CardHeader, CardTitle, CardDescription, CardContent,
  DeviceLoginCard, AlertBanner, Spinner, ThemeToggle,
} from '@neo-open-source/ui-web'
import { useThemeMode } from '../app/ThemeContext'
import { setTokens } from '../api/client'
import styles from '../styles/DeviceLoginPage.module.css'

const POLL_INTERVAL = 3000
const CODE_TTL = 5 * 60 * 1000

export default function DeviceLoginPage() {
  const navigate = useNavigate()
  const { resolved, setMode } = useThemeMode()
  const dark = resolved === 'dark'

  const [code, setCode] = useState('')
  const [qrImage, setQrImage] = useState('')
  const [error, setError] = useState('')
  const [status, setStatus] = useState<'idle' | 'waiting' | 'confirmed' | 'expired'>('idle')
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generateCode = async () => {
    setError('')
    setStatus('idle')
    if (pollRef.current) clearInterval(pollRef.current)
    if (expiryRef.current) clearTimeout(expiryRef.current)

    try {
      const resp = await fetch('/api/device/code', { method: 'POST' })
      if (!resp.ok) throw new Error('Failed to generate code')
      const data = await resp.json()
      const userCode = data.user_code as string
      const deviceCode = data.device_code as string
      setCode(userCode)

      const url = `${window.location.origin}/tv?code=${encodeURIComponent(userCode)}`
      const qr = await QRCode.toDataURL(url, { width: 200, margin: 1 })
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
            if (pollRef.current) clearInterval(pollRef.current)
            if (expiryRef.current) clearTimeout(expiryRef.current)
            setTokens({ accessToken: pd.access_token, refreshToken: pd.refresh_token || '' })
            setStatus('confirmed')
            setTimeout(() => navigate('/'), 1200)
          } else if (pd.status === 'expired') {
            if (pollRef.current) clearInterval(pollRef.current)
            setStatus('expired')
          }
        } catch {
          // ignore poll errors until explicit expiry
        }
      }, POLL_INTERVAL)

      expiryRef.current = setTimeout(() => {
        if (pollRef.current) clearInterval(pollRef.current)
        setStatus('expired')
      }, CODE_TTL)
    } catch (e: unknown) {
      setError((e as { message?: string })?.message || 'Failed to generate code')
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const incomingCode = params.get('code')
    if (incomingCode) {
      sessionStorage.setItem('device_confirm_code', incomingCode)
      navigate('/login')
      return
    }
    generateCode()
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (expiryRef.current) clearTimeout(expiryRef.current)
    }
  }, [])

  const formattedCode = code ? `${code.slice(0, 3)}–${code.slice(3)}` : ''

  return (
    <div className={styles.page}>
      <div className={styles.themeToggle}>
        <ThemeToggle dark={dark} onChange={(d) => setMode(d ? 'dark' : 'light')} />
      </div>

      <div className={styles.container}>
        <Card>
          <CardHeader>
            <CardTitle>Sign in on TV</CardTitle>
            <CardDescription>
              Scan the QR code with your phone or go to <strong>neo.id/tv</strong> and enter the code
            </CardDescription>
          </CardHeader>
          <CardContent>
            {error && <div className={styles.banner}><AlertBanner tone="danger" title={error} onDismiss={() => setError('')} /></div>}
            {status === 'confirmed' && <div className={styles.banner}><AlertBanner tone="success" title="Signed in! Redirecting…" /></div>}

            {error && status === 'idle' ? (
              <div className={styles.centerPad}>
                <Button variant="secondary" onClick={generateCode}>Try again</Button>
              </div>
            ) : null}

            {status === 'expired' ? (
              <div className={styles.expired}>
                <p className={styles.expiredText}>Code expired</p>
                <Button variant="secondary" onClick={generateCode}>Generate new code</Button>
              </div>
            ) : status === 'idle' && !error ? (
              <div className={styles.idleLoading}><Spinner /></div>
            ) : (
              <DeviceLoginCard qrImage={qrImage} code={formattedCode} url="neo.id/tv" onRefresh={generateCode} />
            )}

            {status === 'waiting' ? (
              <p className={styles.waiting}>
                <Spinner /> Waiting for confirmation…
              </p>
            ) : null}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
