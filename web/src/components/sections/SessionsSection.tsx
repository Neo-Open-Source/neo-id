import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Button, AlertBanner, Badge, Spinner } from '@neo-open-source/ui-web'
import { ChevronRight, Code, Command, Settings, Shield, Camera, Smartphone, Monitor, Globe, X } from '@neo-open-source/icons'
import { getSessions, revokeSession, setRefreshDuration } from '../../api/endpoints'
import styles from './SessionsSection.module.css'

interface Session { id: string; user_agent?: string; ip_address?: string; location?: string; is_current?: boolean; last_used_at?: string; created_at?: string; refresh_expires_at?: string }
interface DevicePairingState { code: string; deviceCode: string; qrImage: string; status: 'idle' | 'waiting' | 'confirmed' | 'expired'; error: string }

// Device detection
function getDeviceInfo(ua?: string): { type: string; icon: React.ReactNode; name: string; os: string } {
  if (!ua) return { type: 'unknown', icon: <Globe size={20} />, name: 'Unknown device', os: '' }
  
  const isMobile = /Mobile|Android|iPhone|iPad/.test(ua)
  const isTablet = /iPad|Tablet/.test(ua) && !/Mobile/.test(ua)
  const isTV = /TV|SmartTV|AppleTV|CrKey/.test(ua)
  const isWatch = /Watch|Wearable/.test(ua)
  
  let name = 'Device'
  let os = ''
  
  if (/iPhone/.test(ua)) { name = 'iPhone'; os = 'iOS' }
  else if (/iPad/.test(ua)) { name = 'iPad'; os = 'iPadOS' }
  else if (/Android/.test(ua)) { 
    const match = ua.match(/Android ([0-9.]+)/)
    name = 'Android'; os = match ? `Android ${match[1]}` : 'Android'
  }
  else if (/Mac/.test(ua)) { name = 'Mac'; os = 'macOS' }
  else if (/Windows/.test(ua)) { name = 'Windows PC'; os = 'Windows' }
  else if (/Linux/.test(ua)) { name = 'Linux'; os = 'Linux' }
  
  if (isTV) {
    return { type: 'tv', icon: <Monitor size={20} />, name: 'Smart TV', os }
  }
  if (isWatch) {
    return { type: 'watch', icon: <Smartphone size={20} />, name: 'Smart Watch', os }
  }
  if (isTablet) {
    return { type: 'tablet', icon: <Smartphone size={20} />, name, os }
  }
  if (isMobile) {
    return { type: 'mobile', icon: <Smartphone size={20} />, name, os }
  }
  return { type: 'desktop', icon: <Monitor size={20} />, name, os }
}

function getBrowser(ua?: string): string {
  if (!ua) return ''
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua) && !/Edg\//.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome\//.test(ua)) return 'Safari'
  if (/Opera|OPR\//.test(ua)) return 'Opera'
  return ''
}

function timeAgo(d?: string): string {
  if (!d) return ''
  const m = Math.floor((Date.now() - new Date(d).getTime()) / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const day = Math.floor(h / 24)
  if (day < 7) return `${day}d ago`
  if (day < 30) return `${Math.floor(day / 7)}w ago`
  return new Date(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatExpires(d?: string): string {
  if (!d) return '—'
  const date = new Date(d)
  const now = new Date()
  const days = Math.floor((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  if (days < 1) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days < 7) return `${days} days`
  if (days < 30) return `${Math.floor(days / 7)} weeks`
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

const DURATIONS = [
  { value: 1, label: '1 month' },
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 9, label: '9 months' }
]

// QR Code Scanner Component for mobile
function QRScanner({ onScan, onClose }: { onScan: (code: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [hasCamera, setHasCamera] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  const startCamera = async () => {
    setError('')
    setScanning(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } } })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setHasCamera(true)
    } catch (primaryError) {
      try {
        const fallbackStream = await navigator.mediaDevices.getUserMedia({ video: true })
        if (videoRef.current) {
          videoRef.current.srcObject = fallbackStream
        }
        setHasCamera(true)
      } catch (fallbackError) {
        const err = (fallbackError || primaryError) as { name?: string; message?: string }
        const ua = navigator.userAgent || ''
        const isIOSSimulator = /iPhone|iPad|iPod/.test(ua) && /Simulator/.test(ua)
        if (isIOSSimulator) {
          setError('Camera is not available in iOS Simulator. Use manual code or test on a real device.')
        } else if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
          setError('Camera permission denied. Allow camera in Safari settings and try again.')
        } else if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
          setError('No camera found on this device. Use manual code entry.')
        } else {
          setError('Camera access denied or not available')
        }
        setHasCamera(false)
      }
    } finally {
      setScanning(false)
    }
  }

  useEffect(() => {
    startCamera()
    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: '#000', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <button onClick={onClose} style={{ position: 'absolute', top: 24, right: 24, background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: 8 }}>
        <Shield size={24} />
      </button>
      
      <h3 style={{ color: 'white', marginBottom: 24 }}>Scan QR Code</h3>
      
      {error ? (
        <div style={{ textAlign: 'center', color: 'white' }}>
          <p style={{ marginBottom: 16, opacity: 0.7 }}>{error}</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <Button variant="secondary" onClick={startCamera}>Try camera again</Button>
            <Button variant="ghost" onClick={onClose}>Enter code manually</Button>
          </div>
        </div>
      ) : hasCamera ? (
        <div style={{ position: 'relative', width: 'min(280px, 80vw)', aspectRatio: '1' }}>
          <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 12 }} />
          <div style={{ position: 'absolute', inset: 0, border: '2px solid rgba(255,255,255,0.3)', borderRadius: 12 }}>
            <div style={{ position: 'absolute', top: '20%', left: '20%', right: '20%', bottom: '20%', border: '2px solid rgba(255,255,255,0.5)', borderRadius: 8 }} />
          </div>
          <p style={{ position: 'absolute', bottom: -40, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
            Point camera at QR code
          </p>
        </div>
      ) : scanning ? (
        <Spinner />
      ) : (
        <Spinner />
      )}
    </div>,
    document.body
  )
}

// Device Pairing Modal
function PairDeviceModal({ 
  isOpen, 
  onClose, 
  pairingState, 
  onGenerateCode, 
  onConfirmCode,
  isMobile 
}: { 
  isOpen: boolean
  onClose: () => void
  pairingState: DevicePairingState
  onGenerateCode: () => void
  onConfirmCode: (deviceCode: string) => void
  isMobile: boolean
}) {
  const [showScanner, setShowScanner] = useState(false)
  const [manualCode, setManualCode] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && isMobile && pairingState.status === 'idle') {
      onGenerateCode()
    }
  }, [isOpen, isMobile, pairingState.status, onGenerateCode])

  if (!isOpen) return null

  if (showScanner && isMobile) {
    return (
      <QRScanner 
        onScan={(code) => {
          setManualCode(code)
          setShowScanner(false)
        }} 
        onClose={() => setShowScanner(false)} 
      />
    )
  }

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1300, display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center', padding: isMobile ? 0 : 16 }} onClick={onClose}>
      <div style={{ background: 'var(--neo-surface-1)', borderRadius: isMobile ? '18px 18px 0 0' : 'var(--neo-radius-lg)', width: '100%', maxWidth: isMobile ? '100%' : 420, overflow: 'hidden', maxHeight: isMobile ? '92vh' : 'auto' }} onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--neo-border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>Add new device</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neo-text-muted)', padding: 4 }} aria-label="Close add device modal">
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: isMobile ? '18px 16px calc(20px + env(safe-area-inset-bottom, 0px))' : 24, overflowY: 'auto' }}>
          {pairingState.status === 'confirmed' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--neo-success-500)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                <Settings size={32} color="white" />
              </div>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 500 }}>Device connected!</p>
              <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--neo-text-muted)' }}>You can close this window</p>
            </div>
          ) : pairingState.status === 'expired' ? (
            <div style={{ textAlign: 'center', padding: '20px 0' }}>
              <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>Code expired</p>
              {isMobile ? <Button variant="secondary" onClick={onGenerateCode} style={{ marginTop: 16 }}>Generate new code</Button> : null}
            </div>
          ) : (
            <>
              {pairingState.error && (
                <AlertBanner tone="danger" title={pairingState.error} onDismiss={() => {}} style={{ marginBottom: 16 }} />
              )}

              {isMobile ? (
                // Mobile: Scan other device's QR or enter code manually
                <>
                  <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center' }}>
                    Scan the QR code from the device you want to add, or enter the code shown on that device
                  </p>
                  
                  <Button variant="secondary" onClick={() => setShowScanner(true)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '12px 16px' }}>
                    <Camera size={18} />
                    Scan QR code
                  </Button>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '8px 0' }}>
                    <div style={{ flex: 1, height: 1, background: 'var(--neo-border-subtle)' }} />
                    <span style={{ fontSize: 12, color: 'var(--neo-text-muted)', textTransform: 'uppercase' }}>or</span>
                    <div style={{ flex: 1, height: 1, background: 'var(--neo-border-subtle)' }} />
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input
                      className="neo-id-device-code-input"
                      type="text" 
                      value={manualCode} 
                      onChange={e => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      placeholder="Enter code from device"
                      maxLength={7}
                      style={{ width: '100%', padding: '14px 16px', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-md)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontSize: 16, textAlign: 'center', letterSpacing: 1.2, fontFamily: 'monospace', fontWeight: 600, boxSizing: 'border-box', textTransform: 'uppercase' }}
                    />
                    <Button 
                      disabled={manualCode.length < 6 || isSubmitting}
                      onClick={async () => {
                        setIsSubmitting(true)
                        await onConfirmCode(manualCode.replace(/-/g, ''))
                        setIsSubmitting(false)
                      }}
                      style={{ width: '100%', padding: '12px 16px' }}
                    >
                      {isSubmitting ? <Spinner /> : 'Connect device'}
                    </Button>
                  </div>
                </>
              ) : (
                // Desktop: enter code shown on TV/phone
                <>
                  <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--neo-text-muted)' }}>
                    Enter the code shown on your TV or phone
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <input
                      className="neo-id-device-code-input"
                      type="text"
                      value={manualCode}
                      onChange={e => setManualCode(e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ''))}
                      placeholder="Enter code from TV or phone"
                      maxLength={7}
                      autoFocus
                      style={{ width: '100%', padding: '14px 16px', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-md)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontSize: 16, textAlign: 'center', letterSpacing: 1.2, fontFamily: 'monospace', fontWeight: 600, boxSizing: 'border-box', textTransform: 'uppercase' }}
                    />
                    <Button
                      disabled={manualCode.length < 6 || isSubmitting}
                      onClick={async () => {
                        setIsSubmitting(true)
                        await onConfirmCode(manualCode.replace(/-/g, ''))
                        setIsSubmitting(false)
                      }}
                      style={{ width: '100%', padding: '12px 16px' }}
                    >
                      {isSubmitting ? <Spinner /> : 'Connect device'}
                    </Button>
                  </div>
                </>
              )}
            </>
          )}
        </div>
        <style>{`
          .neo-id-device-code-input::placeholder {
            letter-spacing: 0;
            font-size: 14px;
            font-family: inherit;
            text-transform: none;
          }
        `}</style>
      </div>
    </div>,
    document.body
  )
}

export default function SessionsSection({ currentRefreshMonths = 1, compact = false }: { currentRefreshMonths?: number; compact?: boolean }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState('')
  const [duration, setDuration] = useState(currentRefreshMonths || 1)
  const [durationSaving, setDurationSaving] = useState(false)
  const [durationSaved, setDurationSaved] = useState(false)
  const [showPairModal, setShowPairModal] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [pairingState, setPairingState] = useState<DevicePairingState>({ code: '', deviceCode: '', qrImage: '', status: 'idle', error: '' })
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768 || /Mobile|Android|iPhone/.test(navigator.userAgent))
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const load = async () => {
    setLoading(true)
    try { 
      const d = await getSessions() as { sessions?: Session[] }
      setSessions((d.sessions || []).sort((a: Session, b: Session) => {
        if (a.is_current && !b.is_current) return -1
        if (!a.is_current && b.is_current) return 1
        return new Date(b.last_used_at || b.created_at || 0).getTime() - new Date(a.last_used_at || a.created_at || 0).getTime()
      })) 
    }
    catch { setError('Failed to load sessions') }
    finally { setLoading(false) }
  }
  
  useEffect(() => { load() }, [])

  const onRevoke = async (id: string) => {
    setRevoking(id); setError('')
    try { await revokeSession(id); setSessions(s => s.filter(x => x.id !== id)) }
    catch (e: unknown) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
    finally { setRevoking('') }
  }

  const onSaveDuration = async (val: number) => {
    setDuration(val); setDurationSaving(true)
    try { await setRefreshDuration(val); setDurationSaved(true); setTimeout(() => setDurationSaved(false), 2500) }
    catch (e: unknown) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
    finally { setDurationSaving(false) }
  }

  const generatePairingCode = async () => {
    setPairingState(prev => ({ ...prev, status: 'idle', error: '' }))
    
    if (pollRef.current) clearInterval(pollRef.current)
    if (expiryRef.current) clearTimeout(expiryRef.current)

    // On mobile: just open the interface, user will scan other device's QR
    if (isMobile) {
      setPairingState({ code: '', deviceCode: '', qrImage: '', status: 'waiting', error: '' })
      return
    }

    // On desktop: no generated code/QR, user enters code from TV/phone
    setPairingState({ code: '', deviceCode: '', qrImage: '', status: 'idle', error: '' })
  }

  const confirmManualCode = async (code: string) => {
    try {
      const resp = await fetch('/api/device/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_code: code })
      })
      if (!resp.ok) throw new Error('Invalid code')
      setPairingState(prev => ({ ...prev, status: 'confirmed' }))
      load()
      setTimeout(() => {
        setShowPairModal(false)
        setPairingState({ code: '', deviceCode: '', qrImage: '', status: 'idle', error: '' })
      }, 2000)
    } catch (e: unknown) {
      setPairingState(prev => ({ ...prev, error: (e as { message?: string })?.message || 'Invalid code' }))
    }
  }

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current)
      if (expiryRef.current) clearTimeout(expiryRef.current)
    }
  }, [])

  return (
    <div style={{ background: compact ? 'transparent' : 'var(--neo-surface-1)', border: compact ? 0 : '1px solid var(--neo-border-subtle)', borderRadius: compact ? 0 : 'var(--neo-radius-lg)', padding: compact ? 0 : 24 }}>
      <div className={styles.layout} style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
        
        {/* Session Duration */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <Settings size={16} style={{ color: 'var(--neo-text-muted)' }} />
            <span style={{ fontWeight: 600, fontSize: 14 }}>Session duration</span>
          </div>
          <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--neo-text-muted)' }}>
            How long you stay signed in without using the service
          </p>
          <div className={styles.durationWrap} style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DURATIONS.map(o => (
              <button
                className={`${styles.durationBtn} ${duration === o.value ? styles.durationBtnActive : ''}`}
                key={o.value}
                onClick={() => onSaveDuration(o.value)}
                disabled={durationSaving}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '8px 14px',
                  borderRadius: 10,
                  border: '1px solid var(--neo-border-subtle)',
                  background: duration === o.value ? 'var(--neo-surface-3)' : 'var(--neo-surface-2)',
                  color: duration === o.value ? 'var(--neo-text-primary)' : 'var(--neo-text-muted)',
                  fontSize: 13,
                  cursor: 'pointer',
                  fontWeight: duration === o.value ? 500 : 400,
                  minHeight: 34
                }}
              >
                {o.label}
              </button>
            ))}
            {durationSaved && <span style={{ fontSize: 13, color: 'var(--neo-success-500)', display: 'flex', alignItems: 'center' }}> Saved</span>}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: 'var(--neo-border-subtle)' }} />

        {/* Header with Add Device */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Command size={16} style={{ color: 'var(--neo-text-muted)' }} />
              <span style={{ fontWeight: 600, fontSize: 14 }}>Active sessions</span>
              {sessions.length > 0 && (
                <Badge>{sessions.length}</Badge>
              )}
            </div>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)' }}>
              {sessions.filter(s => s.is_current).length === 1 ? 'This device and others currently signed in' : 'Devices currently signed in'}
            </p>
          </div>
          <div className={styles.actions} style={{ display: 'flex', gap: 8 }}>
            <Button className={styles.refreshBtn} variant="secondary" size="sm" onClick={load} disabled={loading}>
              {loading ? <Spinner /> : 'Refresh'}
            </Button>
            <Button
              className={styles.addBtn}
              size="sm"
              onClick={() => setShowPairModal(true)}
              aria-label="Add device"
              title="Add device"
              style={{ width: 34, minWidth: 34, height: 34, padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span style={{ fontSize: 18, lineHeight: 1, fontWeight: 600 }}>+</span>
            </Button>
          </div>
        </div>

        {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}

        {/* Sessions List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Spinner />
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: 'var(--neo-surface-2)', borderRadius: 'var(--neo-radius-md)' }}>
              <Smartphone size={32} style={{ color: 'var(--neo-text-muted)', marginBottom: 12 }} />
              <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>No active sessions</p>
            </div>
          ) : (
            sessions.map((s) => {
              const device = getDeviceInfo(s.user_agent)
              const browser = getBrowser(s.user_agent)
              
              return (
                <div 
                  className={styles.card}
                  key={s.id} 
                  style={{ 
                    display: 'flex', 
                    alignItems: isMobile ? 'flex-start' : 'center', 
                    gap: 12,
                    padding: 16,
                    background: s.is_current ? 'var(--neo-surface-2)' : 'transparent',
                    border: '1px solid var(--neo-border-subtle)',
                    borderRadius: 'var(--neo-radius-md)',
                    transition: 'background 0.2s'
                  }}
                >
                  <div style={{ 
                    width: 44, 
                    height: 44, 
                    borderRadius: 12, 
                    background: 'var(--neo-surface-3)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: 'var(--neo-text-primary)',
                    flexShrink: 0
                  }}>
                    {device.icon}
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 2 }}>
                      <span style={{ fontWeight: 500, fontSize: 14 }}>{device.name}</span>
                      {browser && <span className={styles.browserChip}>{browser}</span>}
                      {s.is_current && <span className={styles.currentChip}>This device</span>}
                    </div>
                    
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                      {s.location && (
                        <span style={{ fontSize: 12, color: 'var(--neo-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                          <Code size={12} />
                          {s.location}
                        </span>
                      )}
                      <span style={{ fontSize: 12, color: 'var(--neo-text-muted)' }}>
                        {timeAgo(s.last_used_at || s.created_at)}
                      </span>
                      <span style={{ fontSize: 12, color: 'var(--neo-text-muted)' }}>
                        Expires {formatExpires(s.refresh_expires_at)}
                      </span>
                    </div>
                  </div>
                  
                  {!s.is_current && (
                    <Button 
                      variant="danger" 
                      size="sm" 
                      disabled={revoking === s.id}
                      onClick={() => onRevoke(s.id)}
                      style={{ flexShrink: 0 }}
                    >
                      {revoking === s.id ? <Spinner /> : 'Kick'}
                    </Button>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      <PairDeviceModal
        isOpen={showPairModal}
        onClose={() => {
          setShowPairModal(false)
          if (pollRef.current) clearInterval(pollRef.current)
          if (expiryRef.current) clearTimeout(expiryRef.current)
          setPairingState({ code: '', deviceCode: '', qrImage: '', status: 'idle', error: '' })
        }}
        pairingState={pairingState}
        onGenerateCode={generatePairingCode}
        onConfirmCode={confirmManualCode}
        isMobile={isMobile}
      />
    </div>
  )
}
