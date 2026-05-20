import { Button } from '@neo-open-source/ui-web'
import Modal from '../../Modal'
import CodeInput from '../../CodeInput'
import { useEffect, useState } from 'react'

interface Props {
  open: boolean
  pendingEmail?: string
  emailCode: string
  emailLoading: boolean
  emailError?: string
  onClose: () => void
  onCodeChange: (value: string) => void
  onResend: () => void
  onVerify: () => void
  onBackToEmail: () => void
}

export default function EmailVerifyModal({
  open,
  pendingEmail,
  emailCode,
  emailLoading,
  emailError,
  onClose,
  onCodeChange,
  onResend,
  onVerify,
  onBackToEmail,
}: Props) {
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const t = window.setTimeout(() => setCooldown((v) => Math.max(0, v - 1)), 1000)
    return () => window.clearTimeout(t)
  }, [cooldown])

  return (
    <Modal open={open} onClose={onClose} title="Confirm new email" maxWidth={500}>
      <div style={{ display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center', padding: '8px 2px 6px' }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <p style={{ margin: 0, fontSize: 'clamp(1.7rem, 3.4vw, 2.5rem)', lineHeight: 1.02, fontWeight: 700, letterSpacing: '-0.025em' }}>Check your email</p>
          <p style={{ margin: 0, color: 'var(--neo-text-muted)', fontSize: 14, lineHeight: 1.55 }}>
            Enter the 6-digit login code we sent to
            <br />
            <span style={{ color: 'var(--neo-text-secondary)' }}>{pendingEmail || 'your email'}</span>
          </p>
        </div>
        <div style={{ width: '100%', display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 10 }}>
          <CodeInput
            value={emailCode}
            onChange={(v) => onCodeChange(v.replace(/\D/g, '').slice(0, 6))}
            length={6}
            cellStyle={{
              height: 56,
              borderRadius: 14,
              border: '1px solid var(--neo-border-subtle)',
              background: 'var(--neo-surface-2)',
              color: 'var(--neo-text-primary)',
              fontSize: 22,
              fontWeight: 600,
              textAlign: 'center',
            }}
          />
        </div>
        <div style={{ width: '100%', display: 'grid' }}>
          <Button size="sm" variant="secondary" disabled={emailLoading || emailCode.length < 6} onClick={onVerify}>
            Continue
          </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          {cooldown > 0 ? (
            <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', fontWeight: 600 }}>Resend in {cooldown}s</p>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await onResend()
                setCooldown(58)
              }}
              disabled={emailLoading}
              style={{ border: 0, background: 'transparent', color: 'var(--neo-text-primary)', cursor: emailLoading ? 'default' : 'pointer', padding: 0, fontSize: 14, fontWeight: 700, opacity: emailLoading ? 0.6 : 1 }}
            >
              Send code again
            </button>
          )}
        </div>
        {emailError ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--neo-danger-500, #ef4444)', textAlign: 'center' }}>{emailError}</p>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              onBackToEmail()
            }}
          >
            Change email address
          </Button>
        </div>
      </div>
    </Modal>
  )
}
