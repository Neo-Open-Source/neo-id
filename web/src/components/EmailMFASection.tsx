import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Switch } from '@neo-open-source/ui-web'
import styles from '../styles/EmailMFASection.module.css'

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
    <div className={styles.root}>
      <div className={styles.row}>
        <p className={styles.description}>
          Require a one-time code sent to your email every time you sign in
        </p>
        <div className={styles.switchWrap}>
          <Switch checked={enabled} onClick={onToggle} />
        </div>
      </div>
      {enabled && (
        <p className={styles.hint}>
          A 6-digit code will be sent to your email each time you sign in with a password.
        </p>
      )}
    </div>
  )
}
