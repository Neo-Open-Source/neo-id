import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, AlertBanner } from '@neo-open-source/ui-web'
import { Shield, Bell } from '@neo-open-source/icons'
import { totpVerifyEnable, totpDisable, toggleEmailMFA, sendMFACode } from '../api/endpoints'
import AuthShell from '../components/AuthShell'

const SmartphoneIcon = () => <Shield size={28} />
const MailIcon = () => <Bell size={28} />

export default function TwoFAPage() {
  const navigate = useNavigate()
  const action = sessionStorage.getItem('2fa_action') || ''
  const back = sessionStorage.getItem('2fa_back') || '/dashboard'
  const codeType = sessionStorage.getItem('2fa_code_type') || 'totp'
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [altType, setAltType] = useState(codeType)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const refs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!action) { navigate(back); return }
    if (action === 'email_enable' || (action === 'email_disable' && altType === 'email')) sendMFACode().catch(() => {})
    refs.current[0]?.focus()
  }, [])

  const code = digits.join('')
  const onDigitChange = (i: number, val: string) => {
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 6)
      const next = Array(6).fill('')
      for (let j = 0; j < cleaned.length; j++) next[j] = cleaned[j]
      setDigits(next); refs.current[Math.min(cleaned.length, 5)]?.focus(); return
    }
    const digit = val.replace(/\D/g, ''); const next = [...digits]; next[i] = digit; setDigits(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }
  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') { if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n) } else if (i > 0) refs.current[i - 1]?.focus() }
    else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
    else if (e.key === 'Enter' && code.length === 6) onVerify()
  }
  const clearSession = () => ['2fa_action', '2fa_back', '2fa_code_type'].forEach(k => sessionStorage.removeItem(k))
  const onVerify = async () => {
    if (code.length < 6 || loading) return
    setLoading(true); setError('')
    try {
      switch (action) {
        case 'totp_enable': await totpVerifyEnable(code); setSuccess('Authenticator app enabled'); break
        case 'totp_disable': await totpDisable(code); setSuccess('Authenticator app disabled'); break
        case 'email_enable': await toggleEmailMFA(true, code); setSuccess('Email MFA enabled'); break
        case 'email_disable': await toggleEmailMFA(false, code); setSuccess('Email MFA disabled'); break
        default: navigate(back); return
      }
      clearSession(); sessionStorage.setItem('2fa_reload', '1'); setTimeout(() => navigate(back), 800)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid code')
      setDigits(Array(6).fill('')); refs.current[0]?.focus()
    } finally { setLoading(false) }
  }
  const switchAlt = () => {
    const next = altType === 'totp' ? 'email' : 'totp'
    setAltType(next); sessionStorage.setItem('2fa_code_type', next); setDigits(Array(6).fill('')); setError('')
    if (next === 'email') sendMFACode().catch(() => {})
    setTimeout(() => refs.current[0]?.focus(), 50)
  }
  const cfg = ({
    totp_enable:   { icon: <SmartphoneIcon />, title: 'Confirm authenticator app', sub: 'Enter the 6-digit code from your authenticator app', btn: 'Enable', danger: false },
    totp_disable:  { icon: <SmartphoneIcon />, title: 'Disable authenticator app', sub: altType === 'totp' ? 'Enter the code from your authenticator app' : 'Enter the code sent to your email', btn: 'Disable', danger: true },
    email_enable:  { icon: <MailIcon />, title: 'Confirm email verification', sub: 'Enter the 6-digit code sent to your email', btn: 'Enable', danger: false },
    email_disable: { icon: <MailIcon />, title: 'Disable email verification', sub: altType === 'totp' ? 'Enter the code from your authenticator app' : 'Enter the code sent to your email', btn: 'Disable', danger: true },
  } as Record<string, { icon: React.ReactNode; title: string; sub: string; btn: string; danger: boolean }>)[action] || { icon: <Shield size={28} />, title: '2FA verification', sub: 'Enter your 6-digit code', btn: 'Verify', danger: false }
  const canSwitch = (action === 'totp_disable' || action === 'email_disable') && sessionStorage.getItem('2fa_has_both') === '1'

  const inputStyle = (d: string): React.CSSProperties => ({ width: 48, height: 56, border: `1px solid ${d ? 'var(--neo-text-primary)' : 'var(--neo-border-subtle)'}`, borderRadius: 'var(--neo-radius-sm)', fontSize: '1.5rem', fontWeight: 700, textAlign: 'center', outline: 'none', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontFamily: 'inherit', cursor: 'text' })

  return (
    <AuthShell backTo={back} title={cfg.title} description={cfg.sub} hero={<div style={{ display: 'flex', justifyContent: 'center' }}>{cfg.icon}</div>}>
      {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
      {success && <AlertBanner tone="success" title={success} />}
      <div className="neo-id-2fa-grid">
        {digits.map((d, i) => (
          <input key={i} ref={el => (refs.current[i] = el)} type="text" inputMode="numeric" maxLength={6}
            value={d} onChange={e => onDigitChange(i, e.target.value)} onKeyDown={e => onKeyDown(i, e)} onFocus={e => e.target.select()} style={inputStyle(d)} />
        ))}
      </div>
      <Button variant={cfg.danger ? 'danger' : 'primary'} disabled={code.length < 6 || loading || !!success} onClick={onVerify} style={{ width: '100%' }}>
        {loading ? 'Verifying…' : success ? 'Done' : cfg.btn}
      </Button>
      {canSwitch && (
        <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center' }}>
          {altType === 'totp' ? "Don't have your authenticator? " : 'Prefer authenticator app? '}
          <button onClick={switchAlt} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neo-text-primary)', fontWeight: 600, padding: 0, fontSize: 14 }}>
            {altType === 'totp' ? 'Use email code' : 'Use authenticator code'}
          </button>
        </p>
      )}

      <style>{`
        .neo-id-2fa-grid {
          display: grid;
          grid-template-columns: repeat(6, minmax(0, 1fr));
          gap: 8px;
          justify-content: center;
        }
      `}</style>
    </AuthShell>
  )
}
