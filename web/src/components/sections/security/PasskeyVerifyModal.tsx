import { AlertBanner, Button } from '@neo-open-source/ui-web'
import Modal from '../../Modal'
import CodeInput from '../../CodeInput'

interface Props {
  open: boolean
  useEmailMethod: boolean
  email?: string
  code: string
  codeSending: boolean
  checking: boolean
  bothEnabled: boolean
  onClose: () => void
  onCodeChange: (value: string) => void
  onSendCode: () => void
  onContinue: () => void
}

export default function PasskeyVerifyModal({
  open,
  useEmailMethod,
  email,
  code,
  codeSending,
  checking,
  bothEnabled,
  onClose,
  onCodeChange,
  onSendCode,
  onContinue,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Confirm security code">
      <div style={{ display: 'grid', gap: 12 }}>
        {bothEnabled ? <AlertBanner tone="brand" title="Authenticator code is required because OTP is enabled" /> : null}
        {useEmailMethod ? (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center' }}>
            Enter the 6-digit code sent to {email || 'your email'}
          </p>
        ) : (
          <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center' }}>
            Enter the 6-digit code from your authenticator app
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))', gap: 8 }}>
          <CodeInput
            value={code}
            onChange={onCodeChange}
            length={6}
            autoFocus
            cellStyle={{
              height: 44,
              borderRadius: 10,
              border: '1px solid var(--neo-border-subtle)',
              background: 'var(--neo-surface-3)',
              color: 'var(--neo-text-primary)',
              fontSize: 18,
              fontWeight: 600,
              textAlign: 'center',
            }}
          />
        </div>
        {useEmailMethod ? (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Button variant="ghost" size="sm" disabled={codeSending} onClick={onSendCode}>
              {codeSending ? 'Sending…' : 'Send code again'}
            </Button>
          </div>
        ) : null}
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button size="sm" disabled={checking || code.length < 6} onClick={onContinue}>
            {checking ? 'Checking…' : 'Continue'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

