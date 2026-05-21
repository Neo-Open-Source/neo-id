import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner, Button, Spinner } from '@neo-open-source/ui-web'
import { ChevronLeft } from '@neo-open-source/icons'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import CodeInput from '../components/CodeInput'
import SecuritySection from '../components/sections/SecuritySection'
import ServicesSection from '../components/sections/ServicesSection'
import { beginAccountActionPasskeyOptions, deleteAccountConfirmed, exportAccountData, getProfile, getProviders, unlinkProvider, getServices, connectService, disconnectService, logout, sendMFACode } from '../api/endpoints'
import { buildAppNav } from '../navigation/appNav'
import type { OAuthProvider, UserProfile, UserServicesResponse } from '../types/app'
import styles from '../styles/DashboardPage.module.css'

const VALID = ['security', 'apps']
const PROFILE_CACHE_KEY = 'neo_id_profile_cache'
const getHash = () => {
  const h = window.location.hash.replace('#', '')
  return VALID.includes(h) ? h : 'security'
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(getHash)
  const readCachedProfile = (): UserProfile | null => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || '') as UserProfile
    } catch {
      return null
    }
  }
  const [profile, setProfile] = useState<UserProfile | null>(() => readCachedProfile())
  const [providers, setProviders] = useState<OAuthProvider[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState<UserServicesResponse>({})
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(() => !readCachedProfile())
  const [sensitiveAction, setSensitiveAction] = useState<null | 'export' | 'delete'>(null)
  const [codeMethod, setCodeMethod] = useState<'totp' | 'email'>('totp')
  const [resendCooldown, setResendCooldown] = useState(0)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [securityCode, setSecurityCode] = useState('')

  useEffect(() => { window.location.hash = activeSection }, [activeSection])
  useEffect(() => {
    const onHashChange = () => setActiveSection(getHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const load = async () => {
    if (!profile) setLoading(true)
    try {
      const p = await getProfile()
      setProfile(p)
      if (!p?.age_confirmed_16_plus) {
        navigate('/age-consent', { replace: true })
        return
      }
      if (p?.avatar) {
        try { localStorage.setItem('neo_id_avatar_cache', p.avatar) } catch {}
      }
      try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)) } catch {}
      const pr = await getProviders()
      setProviders(pr.oauth_providers || [])
      setHasPassword(!!pr.has_password)
      setServices(await getServices())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => navigate('/login'))
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('2fa_reload')) {
      sessionStorage.removeItem('2fa_reload')
      load().catch(() => {})
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('email_changed') === '1') {
      notify('success', 'Email updated successfully')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const notify = (type: string, text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const handleLogout = async () => {
    await logout()
    clearTokens()
    navigate('/login')
  }

  const onUnlink = async (p: string) => {
    try {
      await unlinkProvider(p)
      await logout()
      clearTokens()
      navigate('/login')
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onConnectService = async (n: string) => {
    try {
      await connectService(n)
      await load()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onDisconnectService = async (n: string) => {
    try {
      await disconnectService(n)
      await load()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onDeleteAccount = async (payload?: { passkey_assertion?: { rawId: string; response: { clientDataJSON: string } } }) => {
    setDeleteLoading(true)
    try {
      await deleteAccountConfirmed(payload?.passkey_assertion ? payload : { mfa_code: securityCode.trim() })
      setSensitiveAction(null)
      setSecurityCode('')
      clearTokens()
      notify('success', 'Account and related data deleted')
      setTimeout(() => navigate('/login'), 400)
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  const onExportData = async (payload?: { passkey_assertion?: { rawId: string; response: { clientDataJSON: string } } }) => {
    try {
      const data = await exportAccountData(payload?.passkey_assertion ? payload : { mfa_code: securityCode.trim() })
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `neo-id-export-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      setSensitiveAction(null)
      setSecurityCode('')
      notify('success', 'Data export downloaded')
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to export data')
    }
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

  const runPasskeyAction = async (action: 'export' | 'delete') => {
    if (!window.isSecureContext || !('credentials' in navigator) || typeof window.PublicKeyCredential === 'undefined') {
      notify('error', 'Passkeys require HTTPS (or localhost) and a supported browser')
      return
    }
    try {
      const optionsRes = await beginAccountActionPasskeyOptions(action) as { publicKey?: { challenge: string; timeout?: number; userVerification?: UserVerificationRequirement; allowCredentials?: { type: PublicKeyCredentialType; id: string }[] } }
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
      if (action === 'delete') {
        await onDeleteAccount(payload)
      } else {
        await onExportData(payload)
      }
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error_description?: string; error?: string } } })?.response?.data?.error_description || (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Passkey verification failed')
    }
  }

  const role = ((profile?.role as string) || '').toLowerCase()
  const hasTotp = !!profile?.totp_enabled
  const hasEmailMFA = !!profile?.email_mfa_enabled
  const hasPasskey = (profile?.passkeys_count || 0) > 0
  const canSwitchMethod = hasTotp && hasEmailMFA

  const startResendCooldown = () => {
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
  }

  const onSendEmailCode = async (opts?: { silent?: boolean }) => {
    try {
      await sendMFACode()
      if (!opts?.silent) notify('success', 'Code sent — check your email.')
      startResendCooldown()
    } catch {
      notify('error', 'Failed to send code to email.')
    }
  }

  const openSensitiveAction = (action: 'export' | 'delete') => {
    const defaultMethod: 'totp' | 'email' = hasTotp ? 'totp' : 'email'
    setSensitiveAction(action)
    setCodeMethod(defaultMethod)
    setSecurityCode('')
    setResendCooldown(0)
    if (defaultMethod === 'email' && hasEmailMFA) void onSendEmailCode({ silent: true })
  }

  const navItems = buildAppNav(role, 'settings', navigate).map((item) =>
    item.id === 'settings' ? { ...item, onClick: () => setActiveSection('security') } : item
  )

  const extraNav: { label: string; onClick: () => void }[] = []

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case 'profile': return 'Profile'
      case 'security': return 'Settings'
      case 'apps': return 'Apps and agents'
      default: return 'Settings'
    }
  }, [activeSection])

  if (loading && !profile) {
    return (
      <div className={styles.fullPageLoading}>
        <Spinner />
      </div>
    )
  }

  if (sensitiveAction) {
    return (
      <div className={styles.fullPageConfirm}>
        <div className={styles.confirmStandalone}>
          {msg.text ? (
            <AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} />
          ) : null}
          <h1 className={styles.confirmStandaloneTitle}>Confirm sensitive action</h1>
          <p className={styles.confirmStandaloneSubtitle}>
            {codeMethod === 'totp' ? 'Enter the 6-digit code from your authenticator.' : 'Enter the 6-digit code sent to your email.'}
          </p>
          {canSwitchMethod ? (
            <div className={styles.codeMethodRow}>
              <button type="button" className={`${styles.codeMethodBtn} ${codeMethod === 'totp' ? styles.codeMethodBtnActive : ''}`} onClick={() => setCodeMethod('totp')}>
                Authenticator
              </button>
              <button
                type="button"
                className={`${styles.codeMethodBtn} ${codeMethod === 'email' ? styles.codeMethodBtnActive : ''}`}
                onClick={() => {
                  setCodeMethod('email')
                  if (resendCooldown === 0) void onSendEmailCode({ silent: true })
                }}
              >
                Email code
              </button>
            </div>
          ) : null}
          <div className={styles.deleteCodeGrid}>
            <CodeInput
              value={securityCode}
              onChange={(v) => setSecurityCode(v.replace(/\D/g, '').slice(0, 6))}
              length={6}
              autoFocus
              cellClassName={styles.deleteCodeCell}
              filledCellClassName={styles.deleteCodeCellFilled}
            />
          </div>
          {codeMethod === 'email' ? (
            <button type="button" className={styles.codeResendBtn} disabled={resendCooldown > 0} onClick={() => void onSendEmailCode()}>
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send code again'}
            </button>
          ) : null}
          {hasPasskey ? (
            <Button variant="ghost" onClick={() => void runPasskeyAction(sensitiveAction)} disabled={deleteLoading}>
              {sensitiveAction === 'export' ? 'Use passkey for export' : 'Use passkey for delete'}
            </Button>
          ) : null}
          <div className={styles.confirmButtons}>
            {sensitiveAction === 'export' ? (
              <Button className={styles.fullButton} variant="secondary" onClick={() => void onExportData()} disabled={deleteLoading}>
                {deleteLoading ? 'Working…' : 'Export data'}
              </Button>
            ) : (
              <Button className={styles.fullButton} variant="danger" onClick={() => void onDeleteAccount()} disabled={deleteLoading}>
                {deleteLoading ? 'Deleting…' : 'Delete permanently'}
              </Button>
            )}
            <button type="button" className={styles.cancelLink} onClick={() => { setSensitiveAction(null); setSecurityCode('') }} disabled={deleteLoading}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <>
      <ResponsiveLayout 
        useAppLayout 
        appLayoutProps={{ title: "Neo ID", profile: profile || undefined, navItems, extraNav, onLogout: undefined, compact: true }}
        mobileTitle={sectionTitle}
        backTo="/"
      >
        <div className={styles.shell} data-section={activeSection}>
          {msg.text && (
            <div className={styles.alert}>
              <AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} />
            </div>
          )}

          <div className={styles.header}>
            {activeSection !== 'security' ? (
              <button
                type="button"
                onClick={() => setActiveSection('security')}
                className={styles.back}
              >
                <ChevronLeft size={16} />
                <span>Back to settings</span>
              </button>
            ) : null}
            <h1 className={styles.title}>{sectionTitle}</h1>
          </div>

          <div>
            {activeSection === 'security' && <SecuritySection profile={profile || undefined} providers={providers} hasPassword={hasPassword} notify={notify} onUnlink={onUnlink} onPasswordChanged={load} onOpenApps={() => setActiveSection('apps')} onDeleteAccount={() => openSensitiveAction('delete')} onExportData={() => openSensitiveAction('export')} onLogout={handleLogout} />}
            {activeSection === 'apps' && <ServicesSection services={services} onConnect={onConnectService} onDisconnect={onDisconnectService} />}
          </div>
        </div>
      </ResponsiveLayout>

    </>
  )
}
