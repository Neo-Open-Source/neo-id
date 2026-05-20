import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, AlertBanner, Switch } from '@neo-open-source/ui-web'
import { totpSetup } from '../api/endpoints'

interface Props { totpEnabled?: boolean; emailMfaEnabled?: boolean }

export default function TOTPSection({ totpEnabled: initialEnabled, emailMfaEnabled }: Props) {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(initialEnabled)
  const [step, setStep] = useState<'idle' | 'setup'>('idle')
  const [setupData, setSetupData] = useState<{ qr_code: string; secret: string } | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onToggle = async () => {
    if (enabled) {
      // Disable flow
      sessionStorage.setItem('2fa_action', 'totp_disable')
      sessionStorage.setItem('2fa_back', '/dashboard')
      sessionStorage.setItem('2fa_code_type', 'totp')
      if (emailMfaEnabled) sessionStorage.setItem('2fa_has_both', '1')
      else sessionStorage.removeItem('2fa_has_both')
      navigate('/2fa')
    } else {
      // Enable flow - show setup
      setLoading(true); setError('')
      try { 
        const data = await totpSetup(); 
        setSetupData(data); 
        setStep('setup')
        setEnabled(false) // Keep switch off until fully enabled
      }
      catch (e: unknown) { setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to set up TOTP') }
      finally { setLoading(false) }
    }
  }

  const goTo2FA = (action: string) => {
    sessionStorage.setItem('2fa_action', action)
    sessionStorage.setItem('2fa_back', '/dashboard')
    sessionStorage.setItem('2fa_code_type', 'totp')
    if (emailMfaEnabled) sessionStorage.setItem('2fa_has_both', '1')
    else sessionStorage.removeItem('2fa_has_both')
    navigate('/2fa')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: 15, color: 'var(--neo-text-primary)' }}>Authenticator app</p>
            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--neo-text-muted)', lineHeight: 1.4 }}>
              {enabled ? 'Two-factor authentication is enabled' : 'Add an extra layer of security'}
            </p>
          </div>
          <Switch checked={enabled} onClick={onToggle} disabled={loading} />
        </div>

        {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}

        {step === 'setup' && setupData && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', lineHeight: 1.4 }}>Scan this QR code with your authenticator app, then click Continue.</p>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <img src={setupData.qr_code} alt="TOTP QR Code" style={{ width: 160, height: 160, border: '1px solid var(--neo-border-subtle)', borderRadius: 12, padding: 10, background: '#fff' }} />
            </div>
            <div style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 12, padding: 14 }}>
              <span style={{ display: 'block', marginBottom: 6, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--neo-text-muted)' }}>Manual entry key</span>
              <code style={{ fontSize: 13, letterSpacing: '0.05em', wordBreak: 'break-all', fontFamily: 'monospace', fontWeight: 600, color: 'var(--neo-text-primary)' }}>{setupData.secret}</code>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <Button size="sm" onClick={() => goTo2FA('totp_enable')}>Continue →</Button>
              <Button variant="ghost" size="sm" onClick={() => { setStep('idle'); setSetupData(null) }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
