import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Switch } from '@neo-open-source/ui-web'

interface Props { emailMfaEnabled?: boolean; totpEnabled?: boolean }

export default function EmailMFASection({ emailMfaEnabled: initialEnabled, totpEnabled }: Props) {
  const navigate = useNavigate()
  const [enabled, setEnabled] = useState(!!initialEnabled)
  useEffect(() => { setEnabled(!!initialEnabled) }, [initialEnabled])

  const onToggle = () => {
    if (enabled) {
      sessionStorage.setItem('2fa_action', 'email_disable')
      sessionStorage.setItem('2fa_back', '/dashboard')
      sessionStorage.setItem('2fa_code_type', totpEnabled ? 'totp' : 'email')
      if (totpEnabled) sessionStorage.setItem('2fa_has_both', '1')
      else sessionStorage.removeItem('2fa_has_both')
    } else {
      sessionStorage.setItem('2fa_action', 'email_enable')
      sessionStorage.setItem('2fa_back', '/dashboard')
      sessionStorage.setItem('2fa_code_type', 'email')
      sessionStorage.removeItem('2fa_has_both')
    }
    navigate('/2fa')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', lineHeight: 1.5, flex: 1 }}>
          Require a one-time code sent to your email every time you sign in
        </p>
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
          <Switch checked={enabled} onClick={onToggle} />
        </div>
      </div>
      {enabled && (
        <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 12, padding: '12px 14px', lineHeight: 1.45 }}>
          A 6-digit code will be sent to your email each time you sign in with a password.
        </p>
      )}
    </div>
  )
}
