import { Button, Input } from '@neo-open-source/ui-web'
import Modal from '../../Modal'

interface Props {
  open: boolean
  emailValue: string
  currentEmail?: string
  emailError?: string
  isSameEmail: boolean
  emailLoading: boolean
  canSendEmailChange: boolean
  onClose: () => void
  onEmailChange: (value: string) => void
  onSend: () => void
}

export default function EmailChangeModal({
  open,
  emailValue,
  currentEmail,
  emailError,
  isSameEmail,
  emailLoading,
  canSendEmailChange,
  onClose,
  onEmailChange,
  onSend,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm email">
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <div style={{ fontSize: 12, color: 'var(--neo-text-muted)', paddingLeft: 2 }}>New email</div>
          <Input value={emailValue} onChange={(e) => onEmailChange(e.target.value)} placeholder="name@example.com" autoFocus />
          {currentEmail ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neo-text-muted)' }}>Current email: {currentEmail}</p>
          ) : null}
          {isSameEmail ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neo-danger-500, #ef4444)' }}>New email must be different from current email.</p>
          ) : null}
          {emailError ? (
            <p style={{ margin: 0, fontSize: 12, color: 'var(--neo-danger-500, #ef4444)' }}>{emailError}</p>
          ) : null}
        </div>
        <div style={{ border: '1px solid var(--neo-border-subtle)', borderRadius: 18, padding: 16, background: 'var(--neo-surface-3)' }}>
          <div style={{ display: 'grid', gap: 12 }}>
            <p style={{ margin: '0 0 2px', fontWeight: 600, fontSize: 16 }}>Send verification</p>
            <p style={{ margin: 0, color: 'var(--neo-text-muted)', fontSize: 14 }}>
              Enter new email and send confirmation. The email will change only after you verify by code or link.
            </p>
            <div style={{ display: 'grid' }}>
              <Button size="sm" disabled={!canSendEmailChange} onClick={onSend}>{emailLoading ? 'Sending…' : 'Send code and link'}</Button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

