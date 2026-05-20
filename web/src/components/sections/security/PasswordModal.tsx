import { AlertBanner, Button, Input } from '@neo-open-source/ui-web'
import Modal from '../../Modal'

interface Props {
  open: boolean
  hasPassword?: boolean
  pwdMfaStep: 'totp' | 'email' | null
  pwdMfaCode: string
  pwdMfaLoading: boolean
  currentPassword: string
  newPassword: string
  confirmPassword: string
  onClose: () => void
  onPwdMfaCodeChange: (value: string) => void
  onCancelMfa: () => void
  onConfirmMfa: () => void
  onCurrentPasswordChange: (value: string) => void
  onNewPasswordChange: (value: string) => void
  onConfirmPasswordChange: (value: string) => void
  onSavePassword: () => void
}

export default function PasswordModal({
  open,
  hasPassword,
  pwdMfaStep,
  pwdMfaCode,
  pwdMfaLoading,
  currentPassword,
  newPassword,
  confirmPassword,
  onClose,
  onPwdMfaCodeChange,
  onCancelMfa,
  onConfirmMfa,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onSavePassword,
}: Props) {
  return (
    <Modal open={open} onClose={onClose} title="Password">
      <div style={{ display: 'grid', gap: 12 }}>
        {pwdMfaStep ? (
          <>
            <AlertBanner tone="brand" title={pwdMfaStep === 'totp' ? 'Enter the code from your authenticator app' : 'Enter the 6-digit code sent to your email'} />
            <Input
              placeholder={pwdMfaStep === 'totp' ? 'Authenticator code' : 'Email code'}
              value={pwdMfaCode}
              onChange={(e) => onPwdMfaCodeChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
              autoFocus
            />
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <Button variant="ghost" size="sm" onClick={onCancelMfa}>Cancel</Button>
              <Button size="sm" disabled={pwdMfaLoading || pwdMfaCode.length < 6} onClick={onConfirmMfa}>Confirm</Button>
            </div>
          </>
        ) : (
          <>
            {hasPassword && <Input type="password" placeholder="Current password" value={currentPassword} onChange={(e) => onCurrentPasswordChange(e.target.value)} autoComplete="current-password" />}
            <Input type="password" placeholder="New password" value={newPassword} onChange={(e) => onNewPasswordChange(e.target.value)} autoComplete="new-password" />
            <Input type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => onConfirmPasswordChange(e.target.value)} autoComplete="new-password" />
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <Button size="sm" onClick={onSavePassword} disabled={!newPassword || newPassword !== confirmPassword || (!!hasPassword && !currentPassword)}>Save password</Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

