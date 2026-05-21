import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner, Button, Input } from '@neo-open-source/ui-web'
import AuthShell from '../components/AuthShell'
import CodeInput from '../components/CodeInput'
import { clearTokens, getAccessToken } from '../api/client'
import { beginAccountActionPasskeyOptions, deleteAccountConfirmed, exportAccountData, getProfile, logout, sendMFACode, setAgeConsent } from '../api/endpoints'
import styles from '../styles/AgeConsentPage.module.css'

export default function AgeConsentPage() {
  const navigate = useNavigate()
  const token = getAccessToken()
  const [checked, setChecked] = useState(false)
  const [loading, setLoading] = useState(false)
  const [working, setWorking] = useState(false)
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [action, setAction] = useState<null | 'export' | 'delete'>(null)
  const [method, setMethod] = useState<'code' | 'passkey'>('code')
  const [codeMethod, setCodeMethod] = useState<'totp' | 'email'>('totp')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [securityState, setSecurityState] = useState({ hasMFA: false, hasPassword: true, hasPasskey: false, totpEnabled: false, emailMFAEnabled: false })
  const [msg, setMsg] = useState({ type: '', text: '' })

  useEffect(() => {
    if (!token) {
      navigate('/login', { replace: true })
      return
    }
    setLoading(true)
    getProfile()
      .then((p) => {
        if (p?.age_confirmed_16_plus) navigate('/dashboard', { replace: true })
        setSecurityState({
          hasMFA: !!(p?.totp_enabled || p?.email_mfa_enabled),
          hasPassword: !!p?.has_password,
          hasPasskey: (p?.passkeys_count || 0) > 0,
          totpEnabled: !!p?.totp_enabled,
          emailMFAEnabled: !!p?.email_mfa_enabled,
        })
      })
      .catch(() => navigate('/login', { replace: true }))
      .finally(() => setLoading(false))
  }, [navigate, token])

  const notify = (type: string, text: string) => setMsg({ type, text })

  const onConfirm = async () => {
    if (!checked) {
      notify('error', 'Please confirm that you are 16 or older.')
      return
    }
    setWorking(true)
    try {
      await setAgeConsent(true)
      notify('success', 'Confirmed. Redirecting…')
      setTimeout(() => navigate('/dashboard', { replace: true }), 300)
    } catch {
      notify('error', 'Failed to save confirmation')
    } finally {
      setWorking(false)
    }
  }

  const onLogout = async () => {
    await logout()
    clearTokens()
    navigate('/login', { replace: true })
  }

  const b64urlToBuffer = (value: string): ArrayBuffer => {
    const pad = '='.repeat((4 - (value.length % 4)) % 4)
    const base64 = (value + pad).replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(base64)
    const buffer = new ArrayBuffer(binary.length)
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    return buffer
  }

  const bytesToB64url = (buffer: ArrayBuffer): string => {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i])
    return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
  }

  const passPayload = () => {
    const normalizedCode = code.replace(/\D/g, '')
    if (normalizedCode.length === 6) return { mfa_code: normalizedCode }
    return { password: password.trim() }
  }

  const runPasskeyAction = async (target: 'export' | 'delete') => {
    try {
      const optionsRes = await beginAccountActionPasskeyOptions(target) as { publicKey?: { challenge: string; timeout?: number; userVerification?: UserVerificationRequirement; allowCredentials?: { type: PublicKeyCredentialType; id: string }[] } }
      const pk = optionsRes?.publicKey
      if (!pk) throw new Error('No passkey challenge')
      const cred = await navigator.credentials.get({
        publicKey: {
          challenge: b64urlToBuffer(pk.challenge),
          timeout: pk.timeout,
          userVerification: pk.userVerification,
          allowCredentials: (pk.allowCredentials || []).map((c) => ({ type: 'public-key', id: b64urlToBuffer(c.id) })),
        },
      }) as PublicKeyCredential | null
      if (!cred) return
      const resp = cred.response as AuthenticatorAssertionResponse
      const payload = {
        passkey_assertion: {
          rawId: bytesToB64url(cred.rawId),
          response: { clientDataJSON: bytesToB64url(resp.clientDataJSON) },
        },
      }
      if (target === 'delete') {
        await deleteAccountConfirmed(payload)
        await onLogout()
      } else {
        const data = await exportAccountData(payload)
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `neo-id-export-${new Date().toISOString().slice(0, 10)}.json`
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.URL.revokeObjectURL(url)
        notify('success', 'Data export downloaded')
      }
      setAction(null)
      setCode('')
      setPassword('')
    } catch {
      notify('error', 'Passkey verification failed')
    }
  }

  const onExport = async () => {
    try {
      const data = await exportAccountData(passPayload())
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `neo-id-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      notify('success', 'Data export downloaded')
    } catch {
      notify('error', 'Failed to export data')
    }
  }

  const onDelete = async () => {
    try {
      await deleteAccountConfirmed(passPayload())
      await onLogout()
    } catch {
      notify('error', 'Failed to delete account')
    }
  }

  const onContinueAction = async () => {
    if (!action) return
    if (method === 'passkey') {
      await runPasskeyAction(action)
      return
    }
    const normalizedCode = code.replace(/\D/g, '')
    const canUseCode = securityState.hasMFA
    const canUsePassword = !securityState.hasMFA && !securityState.hasPasskey && securityState.hasPassword
    if (canUseCode && normalizedCode.length !== 6) {
      notify('error', 'Enter 6-digit code.')
      return
    }
    if (!canUseCode && canUsePassword && !password.trim()) {
      notify('error', 'Enter your password.')
      return
    }
    if (action === 'export') await onExport()
    else await onDelete()
  }

  const openAction = (target: 'export' | 'delete') => {
    const defaultMethod: 'code' | 'passkey' = securityState.hasPasskey ? 'passkey' : 'code'
    const defaultCodeMethod: 'totp' | 'email' = securityState.totpEnabled ? 'totp' : 'email'
    setAction(target)
    setMethod(defaultMethod)
    setCodeMethod(defaultCodeMethod)
    setCode('')
    setPassword('')
    setResendCooldown(0)
    if (defaultMethod === 'code' && defaultCodeMethod === 'email' && securityState.emailMFAEnabled) {
      void onSendEmailCode({ silent: true })
    }
  }

  const onSendEmailCode = async (opts?: { silent?: boolean }) => {
    const silent = !!opts?.silent
    try {
      await sendMFACode()
      if (!silent) setMsg({ type: 'success', text: 'Code sent — check your email.' })
      setResendCooldown(60)
      const timer = setInterval(() => {
        setResendCooldown((v) => {
          if (v <= 1) {
            clearInterval(timer)
            return 0
          }
          return v - 1
        })
      }, 1000)
    } catch {
      setMsg({ type: 'error', text: 'Failed to send code to email.' })
    }
  }

  if (action) {
    const canUseCode = securityState.hasMFA
    const canUsePasskey = securityState.hasPasskey
    const canUsePassword = !securityState.hasMFA && !securityState.hasPasskey && securityState.hasPassword
    const canSwitchCodeMethod = securityState.totpEnabled && securityState.emailMFAEnabled

    return (
      <AuthShell
        desktopSimple
        title={method === 'passkey' ? 'Confirm with passkey' : 'Confirm security code'}
        description={
          method === 'passkey'
            ? 'Use your passkey to continue.'
            : canUseCode
              ? 'Enter the 6-digit code from your authenticator.'
              : 'Enter your password to continue.'
        }
      >
        {msg.text ? <AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} /> : null}

        {method === 'code' ? (
          <div className={styles.verifyCodeWrap}>
            {canUseCode ? (
              <>
                {canSwitchCodeMethod ? (
                  <div className={styles.codeMethodRow}>
                    <button type="button" className={`${styles.codeMethodBtn} ${codeMethod === 'totp' ? styles.codeMethodBtnActive : ''}`} onClick={() => setCodeMethod('totp')}>
                      Authenticator
                    </button>
                    <button type="button" className={`${styles.codeMethodBtn} ${codeMethod === 'email' ? styles.codeMethodBtnActive : ''}`} onClick={() => { setCodeMethod('email'); if (securityState.emailMFAEnabled && resendCooldown === 0) void onSendEmailCode() }}>
                      Email code
                    </button>
                  </div>
                ) : null}
                <div className={styles.codeRow}>
                  <CodeInput value={code} onChange={setCode} length={6} autoFocus cellClassName={styles.codeCell} filledCellClassName={styles.codeCellFilled} />
                </div>
                {codeMethod === 'email' && securityState.emailMFAEnabled ? (
                  <button type="button" className={styles.fallbackBtn} disabled={resendCooldown > 0} onClick={() => void onSendEmailCode()}>
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send code again'}
                  </button>
                ) : null}
              </>
            ) : null}
            {canUsePassword ? (
              <Input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} />
            ) : null}
          </div>
        ) : (
          <p className={styles.passkeyHint}>Passkey prompt will open when you press Continue.</p>
        )}

        <div className={styles.verifySwitches}>
          {canUsePasskey && method !== 'passkey' ? (
            <button type="button" className={styles.fallbackBtn} onClick={() => setMethod('passkey')}>
              Use passkey instead
            </button>
          ) : null}
          {canUseCode && method !== 'code' ? (
            <button type="button" className={styles.fallbackBtn} onClick={() => setMethod('code')}>
              Use MFA/TOTP code instead
            </button>
          ) : null}
        </div>

        <Button className={styles.full} variant={action === 'delete' ? 'danger' : 'primary'} onClick={() => void onContinueAction()}>
          {action === 'delete' ? 'Delete account' : 'Continue'}
        </Button>
        <button type="button" className={styles.cancelLink} onClick={() => setAction(null)}>
          Cancel
        </button>
      </AuthShell>
    )
  }

  return (
    <AuthShell desktopSimple title="Age confirmation required" description="Before using Neo ID, confirm your age.">
      {msg.text ? <AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} /> : null}

      <label className={styles.check}>
        <input
          type="checkbox"
          className={styles.checkInput}
          checked={checked}
          onChange={(e) => setChecked(e.target.checked)}
          aria-label="I confirm that I am 16 years old or older"
        />
        <span className={styles.checkLabel}>I confirm that I am 16 years old or older.</span>
      </label>

      <Button className={styles.full} disabled={loading || working} onClick={onConfirm}>
        {working ? 'Saving…' : 'Continue'}
      </Button>

      <div className={styles.actions}>
        <p className={styles.note}>Need to export data or delete account instead?</p>
        <div className={styles.row}>
          <Button variant="secondary" onClick={() => openAction('export')}>Export data</Button>
          <Button variant="danger" onClick={() => openAction('delete')}>Delete account</Button>
        </div>
      </div>
    </AuthShell>
  )
}
