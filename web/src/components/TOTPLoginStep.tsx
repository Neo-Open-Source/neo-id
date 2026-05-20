import { useState } from 'react'
import { Button, AlertBanner } from '@neo-open-source/ui-web'
import { totpLoginVerify } from '../api/endpoints'
import styles from '../styles/TOTPLoginStep.module.css'
import CodeInput from './CodeInput'

interface Props {
  email: string
  siteId?: string
  redirectUrl?: string
  siteState?: string
  onBack: () => void
  onSuccess: (data: unknown) => Promise<void>
}

export default function TOTPLoginStep({ email, siteId, redirectUrl, siteState, onBack, onSuccess }: Props) {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const onVerify = async () => {
    if (code.length < 6 || loading) return
    setLoading(true); setError('')
    try {
      const data = await totpLoginVerify(email, code, siteId, redirectUrl, siteState)
      await onSuccess(data)
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid code')
      setCode('')
    } finally { setLoading(false) }
  }

  return (
    <div className={styles.container}>
      <div className={styles.inner}>
        <button onClick={onBack} className={styles.backButton}>← Back</button>
        <div className={styles.header}>
          <h2>Two-factor authentication</h2>
          <p>Enter the 6-digit code from your authenticator app</p>
        </div>
        {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
        <div className={styles.grid}>
          <CodeInput
            value={code}
            onChange={setCode}
            onEnter={onVerify}
            cellClassName={styles.input}
            filledCellClassName={styles.inputFilled}
          />
        </div>
        <Button disabled={code.length < 6 || loading} onClick={onVerify} style={{ width: '100%' }}>
          {loading ? 'Verifying…' : 'Continue'}
        </Button>
      </div>
    </div>
  )
}
