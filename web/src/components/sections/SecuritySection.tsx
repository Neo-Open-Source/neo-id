import { useEffect, useState } from 'react'
import { Button } from '@neo-open-source/ui-web'
import { ChevronRight, Command, Globe, KeyRound, LogOut, Mail, MailCheck, Shield, Smartphone, Trash, UserRound, X } from '@neo-open-source/icons'
import { getAccessToken } from '../../api/client'
import { beginPasskeyRegistration, deletePasskey, finishPasskeyRegistration, listPasskeys, requestEmailChange, resendVerifyEmail, sendMFACode, setPassword, updateProfile, verifyEmailCode } from '../../api/endpoints'
import Modal from '../Modal'
import TOTPSection from '../TOTPSection'
import EmailMFASection from '../EmailMFASection'
import SessionsSection from './SessionsSection'
import styles from './SecuritySection.module.css'
import EmailChangeModal from './security/EmailChangeModal'
import EmailVerifyModal from './security/EmailVerifyModal'
import NameModal from './security/NameModal'
import LinkedAccountsModal from './security/LinkedAccountsModal'
import PasskeyVerifyModal from './security/PasskeyVerifyModal'
import PasskeysModal from './security/PasskeysModal'
import PasswordModal from './security/PasswordModal'
import { useSecuritySectionState, type SecurityPasskey, type SecurityPasskeyPublicKeyOptions } from './security/useSecuritySectionState'

interface Provider { provider: string; external_id?: string }
interface Profile { totp_enabled?: boolean; email_mfa_enabled?: boolean; display_name?: string; email?: string; first_name?: string; last_name?: string; email_verified?: boolean; pending_email?: string; passkeys_count?: number }
export default function SecuritySection({ profile, providers, hasPassword, notify, onUnlink, onPasswordChanged, onOpenApps, onDeleteAccount, onLogout }: {
  profile?: Profile
  providers?: Provider[]
  hasPassword?: boolean
  notify?: (t: string, m: string) => void
  onUnlink?: (p: string) => void
  onPasswordChanged?: () => void
  onOpenApps?: () => void
  onDeleteAccount?: () => void
  onLogout?: () => void | Promise<void>
}) {
  const {
    isEmailVerified,
    preferredName,
    linkedCount,
    newPassword, setNewPassword,
    confirmPassword, setConfirmPassword,
    currentPassword, setCurrentPassword,
    pwdMfaStep, setPwdMfaStep,
    pwdMfaCode, setPwdMfaCode,
    pwdMfaLoading, setPwdMfaLoading,
    activeModal, setActiveModal,
    displayName, setDisplayName,
    firstName, setFirstName,
    lastName, setLastName,
    nameSaving, setNameSaving,
    emailValue, setEmailValue,
    emailLoading, setEmailLoading,
    emailCode, setEmailCode,
    emailError, setEmailError,
    passkeys, setPasskeys,
    passkeyLoading, setPasskeyLoading,
    passkeyName, setPasskeyName,
    passkeyMFACode, setPasskeyMFACode,
    passkeyCodeSending, setPasskeyCodeSending,
    passkeyVerifyLoading, setPasskeyVerifyLoading,
    passkeyCreationOptions, setPasskeyCreationOptions,
    passkeyEnforcedMethod,
    passkeyRequiresMFA,
    isSameEmail,
    canSendEmailChange,
  } = useSecuritySectionState(profile, (providers || []).length)
  const hasPasskey = (profile?.passkeys_count || 0) > 0
  const dismissKey = `neoid:passkey-prompt:dismissed:${(profile?.email || 'anon').toLowerCase()}`
  const [showPasskeyPrompt, setShowPasskeyPrompt] = useState(true)

  useEffect(() => {
    if (hasPasskey) {
      setShowPasskeyPrompt(false)
      return
    }
    try {
      const dismissed = window.localStorage.getItem(dismissKey) === '1'
      setShowPasskeyPrompt(!dismissed)
    } catch {
      setShowPasskeyPrompt(true)
    }
  }, [dismissKey, hasPasskey, setShowPasskeyPrompt])

  const b64urlToBuffer = (value: string): ArrayBuffer => {
    const pad = '='.repeat((4 - (value.length % 4)) % 4)
    const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const buffer = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i)
    }
    return buffer
  }

  const bytesToB64url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  const onAddPasskey = async () => {
    try {
      if (!window.isSecureContext || !('credentials' in navigator) || typeof window.PublicKeyCredential === 'undefined') {
        notify?.('error', 'Passkeys require HTTPS (or localhost) and a supported browser')
        return
      }
      setPasskeyLoading(true)
      let pk = passkeyCreationOptions
      if (!pk) {
        const optionsRes = await beginPasskeyRegistration(passkeyRequiresMFA ? passkeyMFACode : undefined)
        pk = optionsRes?.publicKey as SecurityPasskeyPublicKeyOptions
      }
      if (!pk) throw new Error('No publicKey options')

      const publicKey: PublicKeyCredentialCreationOptions = {
        rp: pk.rp,
        challenge: b64urlToBuffer(pk.challenge),
        user: {
          id: b64urlToBuffer(pk.user.id),
          name: pk.user.name,
          displayName: pk.user.displayName,
        },
        pubKeyCredParams: pk.pubKeyCredParams,
        authenticatorSelection: pk.authenticatorSelection,
        timeout: pk.timeout,
        attestation: pk.attestation,
        excludeCredentials: (pk.excludeCredentials || []).map((c) => ({
          type: 'public-key' as PublicKeyCredentialType,
          id: b64urlToBuffer(c.id),
        })),
      }

      const credential = await navigator.credentials.create({ publicKey }) as PublicKeyCredential | null

      if (!credential) throw new Error('Passkey creation cancelled')
      const response = credential.response as AuthenticatorAttestationResponse
      const transports = typeof response.getTransports === 'function' ? response.getTransports() : []
      const rawId = bytesToB64url(credential.rawId)

      await finishPasskeyRegistration({
        name: passkeyName.trim() || 'This device',
        id: credential.id,
        rawId,
        type: credential.type,
        response: {
          clientDataJSON: bytesToB64url(response.clientDataJSON),
          attestationObject: bytesToB64url(response.attestationObject),
          transports,
        },
      })

      const r = await listPasskeys()
      setPasskeys((r?.passkeys || []) as SecurityPasskey[])
      setPasskeyName('')
      setPasskeyMFACode('')
      setPasskeyCreationOptions(null)
      notify?.('success', 'Passkey added')
    } catch (e: unknown) {
      const msg = (e as Error)?.message || 'Failed to add passkey'
      notify?.('error', msg)
    } finally {
      setPasskeyLoading(false)
    }
  }

  const openPasskeyFlow = () => {
    if (passkeyRequiresMFA) {
      setPasskeyMFACode('')
      setActiveModal('passkeyVerify')
      return
    }
    setActiveModal('passkeys')
  }

  useEffect(() => {
    if (activeModal !== 'passkeys') return
    setPasskeyLoading(true)
    listPasskeys()
      .then((r) => setPasskeys((r?.passkeys || []) as SecurityPasskey[]))
      .catch(() => notify?.('error', 'Failed to load passkeys'))
      .finally(() => setPasskeyLoading(false))
  }, [activeModal, notify])

  useEffect(() => {
    if (activeModal !== 'email' && activeModal !== 'emailVerify') return
    setEmailError('')
    setEmailCode('')
    setEmailValue(profile?.pending_email || '')
  }, [activeModal, profile?.pending_email, profile?.email])

  // Close email verify modal if pending_email is cleared (e.g., after reload when already verified)
  useEffect(() => {
    if (activeModal === 'emailVerify' && !profile?.pending_email) {
      setActiveModal(null)
      setEmailCode('')
    }
  }, [activeModal, profile?.pending_email])

  const linkProvider = (p: string) => {
    window.location.href = `/api/auth/login/${p}?link=1&token=${encodeURIComponent(getAccessToken())}`
  }

  const onSetPassword = async (mfaCode?: string) => {
    if (newPassword !== confirmPassword) { notify?.('error', 'Passwords do not match'); return }
    if (newPassword.length < 8) { notify?.('error', 'Password must be at least 8 characters'); return }
    try {
      await setPassword(newPassword, currentPassword, mfaCode)
      setNewPassword('')
      setConfirmPassword('')
      setCurrentPassword('')
      setPwdMfaStep(null)
      setPwdMfaCode('')
      setActiveModal(null)
      notify?.('success', 'Password updated')
      onPasswordChanged?.()
    } catch (e: unknown) {
      const err = e as { response?: { data?: { error?: string; mfa_type?: string } } }
      const msg = err?.response?.data?.error || 'Failed'
      const mfaType = err?.response?.data?.mfa_type
      if (msg === 'mfa_required' || mfaType) {
        setPwdMfaStep((mfaType as 'totp' | 'email') || 'totp')
        return
      }
      notify?.('error', msg)
    }
  }

  const onSaveName = async () => {
    setNameSaving(true)
    try {
      await updateProfile({
        display_name: displayName.trim() || undefined,
        first_name: firstName.trim() || undefined,
        last_name: lastName.trim() || undefined,
      })
      notify?.('success', 'Profile updated')
      setActiveModal(null)
      onPasswordChanged?.()
    } catch (e: unknown) {
      notify?.('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update profile')
    } finally {
      setNameSaving(false)
    }
  }

  const onRequestEmailChange = async () => {
    if (isSameEmail) {
      setEmailError('Enter a different new email address.')
      return
    }
    setEmailLoading(true)
    setEmailError('')
    try {
      await requestEmailChange(emailValue)
      notify?.('success', 'Verification link and code sent to your new email')
      setActiveModal('emailVerify')
      setEmailCode('')
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to change email'
      const normalized = msg === 'email is unchanged' || msg === 'invalid_request'
      setEmailError(normalized ? 'Enter a different new email address.' : msg)
      notify?.('error', msg)
    } finally {
      setEmailLoading(false)
    }
  }

  const onResendCurrentVerification = async () => {
    setEmailLoading(true)
    try {
      const targetEmail = profile?.pending_email || profile?.email || ''
      await resendVerifyEmail(targetEmail)
      notify?.('success', 'Verification email resent')
    } catch (e: unknown) {
      notify?.('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to resend email')
    } finally {
      setEmailLoading(false)
    }
  }

  const surface = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div className={styles.surface} style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 22, padding: 12, ...style }}>{children}</div>
  )

  const row = ({ label, value, onClick, icon }: { label: string; value?: string; onClick?: () => void; icon?: React.ReactNode }) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        minHeight: 54,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '0 8px',
        border: 0,
        borderRadius: 16,
        background: 'transparent',
        color: 'var(--neo-text-primary)',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, fontSize: 15, fontWeight: 500 }}>
        {icon ? <span style={{ display: 'inline-flex', color: 'var(--neo-text-secondary)' }}>{icon}</span> : null}
        <span>{label}</span>
      </span>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: 'var(--neo-text-muted)', fontSize: 14 }}>
        {value ? <span>{value}</span> : null}
        {onClick ? <ChevronRight size={16} /> : null}
      </span>
    </button>
  )

  return (
    <div className={styles.root} style={{ display: 'grid', gap: 22 }}>
      {showPasskeyPrompt ? surface(
        <div className={styles.hero} style={{ display: 'flex', alignItems: 'flex-start', gap: 16, position: 'relative' }}>
          {(!hasPasskey && showPasskeyPrompt) ? (
            <button
              type="button"
              aria-label="Dismiss passkey suggestion"
              onClick={() => {
                setShowPasskeyPrompt(false)
                try { window.localStorage.setItem(dismissKey, '1') } catch {}
              }}
              style={{ position: 'absolute', top: 0, right: 0, width: 28, height: 28, borderRadius: 999, border: '1px solid var(--neo-border-subtle)', background: 'var(--neo-surface-3)', color: 'var(--neo-text-muted)', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <X size={14} />
            </button>
          ) : null}
          <div className={styles.heroIcon} style={{ width: 36, height: 36, borderRadius: 12, display: 'grid', placeItems: 'center', background: 'var(--neo-surface-3)' }}>
            <Shield size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 600, fontSize: 18 }}>Verification</p>
            <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)' }}>
              {isEmailVerified ? 'Your account is verified and ready for faster sign-ins.' : 'Confirm your email and add a passkey to secure your account on this device.'}
            </p>
            <div className={styles.heroMeta} style={{ marginTop: 14, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`${styles.badge} ${isEmailVerified ? styles.badgeSuccess : ''}`}>{isEmailVerified ? 'Email verified' : 'Email pending'}</span>
              {(!hasPasskey && showPasskeyPrompt) ? (
                <Button size="sm" onClick={() => (isEmailVerified ? openPasskeyFlow() : setActiveModal('email'))}>{isEmailVerified ? 'Add passkey' : 'Verify email'}</Button>
              ) : null}
            </div>
          </div>
        </div>,
        { padding: 20 }
      ) : null}

      <div style={{ display: 'grid', gap: 10 }}>
        <p className={styles.sectionLabel}>Account</p>
        {surface(
          <div style={{ display: 'grid' }}>
            {row({ label: 'Profile', value: preferredName, onClick: () => setActiveModal('name'), icon: <UserRound size={18} /> })}
            {row({ label: 'Email', value: profile?.email || 'Not set', onClick: () => {
              setActiveModal('email')
            }, icon: profile?.email_verified ? <MailCheck size={18} /> : <Mail size={18} /> })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        <p className={styles.sectionLabel}>Security</p>
        {surface(
          <div style={{ display: 'grid' }}>
            {row({ label: 'Linked accounts', value: `${linkedCount}`, onClick: () => setActiveModal('linked'), icon: <Globe size={18} /> })}
            {row({ label: 'Authenticator app', value: profile?.totp_enabled ? 'On' : 'Off', onClick: () => setActiveModal('totp'), icon: <Shield size={18} /> })}
            {row({ label: 'Email verification on login', value: profile?.email_mfa_enabled ? 'On' : 'Off', onClick: () => setActiveModal('emailMfa'), icon: <MailCheck size={18} /> })}
            {row({ label: 'Apps and agents', onClick: onOpenApps, icon: <Command size={18} /> })}
            {row({ label: 'Passkeys', value: 'Set up', onClick: openPasskeyFlow, icon: <KeyRound size={18} /> })}
            {row({ label: 'Sessions', onClick: () => setActiveModal('activity'), icon: <Smartphone size={18} /> })}
            {row({ label: 'Password', value: hasPassword ? 'Enabled' : 'Not set', onClick: () => setActiveModal('password'), icon: <Shield size={18} /> })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button variant="ghost" onClick={() => onLogout?.()}><LogOut size={16} /> Log out</Button>
        <button type="button" onClick={onDeleteAccount} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: 0, background: 'transparent', color: 'var(--neo-text-primary)', cursor: 'pointer', fontSize: 15 }}><Trash size={16} /> Delete account</button>
      </div>

      <NameModal
        open={activeModal === 'name'}
        onClose={() => setActiveModal(null)}
        displayName={displayName}
        firstName={firstName}
        lastName={lastName}
        saving={nameSaving}
        onDisplayNameChange={setDisplayName}
        onFirstNameChange={setFirstName}
        onLastNameChange={setLastName}
        onSave={onSaveName}
      />

      <EmailChangeModal
        open={activeModal === 'email'}
        onClose={() => setActiveModal(null)}
        emailValue={emailValue}
        currentEmail={profile?.email}
        emailError={emailError}
        isSameEmail={isSameEmail}
        emailLoading={emailLoading}
        canSendEmailChange={canSendEmailChange}
        onEmailChange={setEmailValue}
        onSend={onRequestEmailChange}
      />

      <EmailVerifyModal
        open={activeModal === 'emailVerify'}
        onClose={() => setActiveModal(null)}
        pendingEmail={profile?.pending_email}
        emailCode={emailCode}
        emailLoading={emailLoading}
        emailError={emailError}
        onCodeChange={setEmailCode}
        onResend={onResendCurrentVerification}
        onBackToEmail={() => setActiveModal('email')}
        onVerify={async () => {
          setEmailLoading(true)
          try {
            await verifyEmailCode((profile?.pending_email || profile?.email || '').toString(), emailCode)
            notify?.('success', 'Email verified successfully')
            setEmailCode('')
            setActiveModal(null)
            // Force refresh profile to update pending_email state
            onPasswordChanged?.()
          } catch (e: unknown) {
            notify?.('error', (e as { response?: { data?: { error_description?: string; error?: string } } })?.response?.data?.error_description || (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid code')
          } finally {
            setEmailLoading(false)
          }
        }}
      />

      <LinkedAccountsModal
        open={activeModal === 'linked'}
        onClose={() => setActiveModal(null)}
        providers={providers}
        onUnlink={onUnlink}
        onLinkGoogle={() => linkProvider('google')}
        onLinkGithub={() => linkProvider('github')}
      />

      <PasskeyVerifyModal
        open={activeModal === 'passkeyVerify'}
        onClose={() => setActiveModal(null)}
        useEmailMethod={passkeyEnforcedMethod === 'email'}
        email={profile?.email}
        code={passkeyMFACode}
        codeSending={passkeyCodeSending}
        checking={passkeyVerifyLoading}
        bothEnabled={!!profile?.totp_enabled && !!profile?.email_mfa_enabled}
        onCodeChange={setPasskeyMFACode}
        onSendCode={async () => {
          setPasskeyCodeSending(true)
          try {
            await sendMFACode()
            notify?.('success', 'Verification code sent to your email')
          } catch {
            notify?.('error', 'Failed to send verification code')
          } finally {
            setPasskeyCodeSending(false)
          }
        }}
        onContinue={async () => {
          setPasskeyVerifyLoading(true)
          try {
            const optionsRes = await beginPasskeyRegistration(passkeyMFACode)
            setPasskeyCreationOptions((optionsRes?.publicKey || null) as SecurityPasskeyPublicKeyOptions | null)
            setActiveModal('passkeys')
          } catch (e: unknown) {
            const msg = (e as { response?: { data?: { error_description?: string; error?: string } } })?.response?.data?.error_description || (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Invalid code'
            notify?.('error', msg)
          } finally {
            setPasskeyVerifyLoading(false)
          }
        }}
      />

      <PasskeysModal
        open={activeModal === 'passkeys'}
        onClose={() => setActiveModal(null)}
        loading={passkeyLoading}
        passkeys={passkeys}
        passkeyName={passkeyName}
        onPasskeyNameChange={setPasskeyName}
        onAdd={onAddPasskey}
        onRemove={async (id) => {
          try {
            await deletePasskey(id)
            setPasskeys((prev) => prev.filter((x) => x.id !== id))
            notify?.('success', 'Passkey removed')
          } catch {
            notify?.('error', 'Failed to remove passkey')
          }
        }}
      />

      <Modal open={activeModal === 'activity'} onClose={() => setActiveModal(null)} title="Sessions" maxWidth={760}>
        <SessionsSection compact />
      </Modal>

      <Modal open={activeModal === 'totp'} onClose={() => setActiveModal(null)} title="Authenticator app">
        <TOTPSection totpEnabled={profile?.totp_enabled} emailMfaEnabled={profile?.email_mfa_enabled} />
      </Modal>

      <Modal open={activeModal === 'emailMfa'} onClose={() => setActiveModal(null)} title="Email verification on login">
        <EmailMFASection emailMfaEnabled={profile?.email_mfa_enabled} totpEnabled={profile?.totp_enabled} />
      </Modal>

      <PasswordModal
        open={activeModal === 'password'}
        onClose={() => setActiveModal(null)}
        hasPassword={hasPassword}
        pwdMfaStep={pwdMfaStep}
        pwdMfaCode={pwdMfaCode}
        pwdMfaLoading={pwdMfaLoading}
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        onPwdMfaCodeChange={setPwdMfaCode}
        onCancelMfa={() => { setPwdMfaStep(null); setPwdMfaCode('') }}
        onConfirmMfa={() => { setPwdMfaLoading(true); onSetPassword(pwdMfaCode).finally(() => setPwdMfaLoading(false)) }}
        onCurrentPasswordChange={setCurrentPassword}
        onNewPasswordChange={setNewPassword}
        onConfirmPasswordChange={setConfirmPassword}
        onSavePassword={() => onSetPassword()}
      />

    </div>
  )
}
