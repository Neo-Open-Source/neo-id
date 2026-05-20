import { Button } from '@neo-open-source/ui-web'
import Modal from '../../Modal'
import CodeInput from '../../CodeInput'

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
  return (
    <Modal open={open} onClose={onClose} title="Confirm new email">
      <div style={{ display: 'grid', gap: 14, justifyItems: 'center', textAlign: 'center', padding: '8px 0 2px' }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <p style={{ margin: 0, fontSize: 48, lineHeight: 0.95, fontWeight: 700, letterSpacing: '-0.03em' }}>Check your email</p>
          <p style={{ margin: 0, color: 'var(--neo-text-muted)', fontSize: 16, lineHeight: 1.5 }}>
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
        <div style={{ width: '100%', display: 'grid', gap: 10 }}>
          <Button size="sm" variant="secondary" disabled={emailLoading || emailCode.length < 6} onClick={onVerify}>
            Continue
          </Button>
          <button
            type="button"
            onClick={onResend}
            disabled={emailLoading}
            style={{
              border: 0,
              background: 'transparent',
              color: 'var(--neo-text-primary)',
              cursor: emailLoading ? 'default' : 'pointer',
              padding: 0,
              fontSize: 14,
              fontWeight: 600,
              opacity: emailLoading ? 0.6 : 1,
            }}
          >
            Send code again
          </button>
        </div>
        <button
          type="button"
          onClick={onBackToEmail}
          style={{ border: 0, background: 'transparent', color: 'var(--neo-text-muted)', cursor: 'pointer', padding: 0, textAlign: 'center', fontSize: 13 }}
        >
          Change email address
        </button>
        {emailError ? (
          <p style={{ margin: 0, fontSize: 12, color: 'var(--neo-danger-500, #ef4444)' }}>{emailError}</p>
        ) : null}
      </div>
    </Modal>
  )
}
