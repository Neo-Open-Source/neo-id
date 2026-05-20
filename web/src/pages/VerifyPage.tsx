import { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Button, AlertBanner, Spinner } from '@neo-open-source/ui-web'
import AuthShell from '../components/AuthShell'
import { mfaVerify, verifyEmailCode, resendVerifyEmail, totpLoginVerify } from '../api/endpoints'
import { setTokens } from '../api/client'
import styles from '../styles/VerifyPage.module.css'

export default function VerifyPage() {
  const navigate = useNavigate()
  const [digits, setDigits] = useState(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const cooldownRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // OAuth callback passes MFA context via hash — consume it into sessionStorage
  if (window.location.hash && window.location.hash.length > 1) {
    const hashParams = new URLSearchParams(window.location.hash.slice(1))
    if (hashParams.get('mfa_email')) {
      hashParams.forEach((v, k) => sessionStorage.setItem(k, v))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }

  const email = sessionStorage.getItem('mfa_email') || ''
  const verifyType = sessionStorage.getItem('mfa_verify_type') || 'mfa'
  const siteId = sessionStorage.getItem('mfa_site_id') || ''
  const redirectUrl = sessionStorage.getItem('mfa_redirect_url') || ''
  const siteState = sessionStorage.getItem('mfa_site_state') || ''
  const mfaOIDC = sessionStorage.getItem('mfa_oidc') === '1'
  const mfaClientID = sessionStorage.getItem('mfa_client_id') || ''
  const mfaRedirectURI = sessionStorage.getItem('mfa_redirect_uri') || ''
  const mfaState = sessionStorage.getItem('mfa_state') || ''
  const mfaScope = sessionStorage.getItem('mfa_scope') || 'openid profile email'
  const mfaMode = sessionStorage.getItem('mfa_mode') || ''
  const isEmailVerify = verifyType === 'email'

  const startCooldown = (s = 60) => {
    setResendCooldown(s); if (cooldownRef.current) clearInterval(cooldownRef.current)
    cooldownRef.current = setInterval(() => setResendCooldown(v => { if (v <= 1) { clearInterval(cooldownRef.current!); return 0 } return v - 1 }), 1000)
  }

  useEffect(() => {
    if (!email) { navigate('/login'); return }
    refs.current[0]?.focus()
    if (isEmailVerify) startCooldown(60)
    return () => { if (cooldownRef.current) clearInterval(cooldownRef.current) }
  }, [])

  const code = digits.join('')
  const onDigitChange = (i: number, val: string) => {
    if (val.length > 1) {
      const cleaned = val.replace(/\D/g, '').slice(0, 6); const next = Array(6).fill('')
      for (let j = 0; j < cleaned.length; j++) next[j] = cleaned[j]
      setDigits(next); refs.current[Math.min(cleaned.length, 5)]?.focus(); return
    }
    const digit = val.replace(/\D/g, ''); const next = [...digits]; next[i] = digit; setDigits(next)
    if (digit && i < 5) refs.current[i + 1]?.focus()
  }
  const onKeyDown = (i: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace') { if (digits[i]) { const n = [...digits]; n[i] = ''; setDigits(n) } else if (i > 0) refs.current[i - 1]?.focus() }
    else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
    else if (e.key === 'Enter' && code.length === 6) onVerify()
  }
  const clearSession = () => ['mfa_email','mfa_verify_type','mfa_site_id','mfa_redirect_url','mfa_site_state','mfa_oidc','mfa_client_id','mfa_redirect_uri','mfa_state','mfa_scope','mfa_mode'].forEach(k => sessionStorage.removeItem(k))
  const continueOIDC = async (token: string) => {
    if (!mfaOIDC || !mfaClientID || !mfaRedirectURI) return false
    const resp = await fetch('/api/auth/check-token', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ client_id: mfaClientID, redirect_uri: mfaRedirectURI, state: mfaState, scope: mfaScope, mode: mfaMode }) })
    const payload = await resp.json().catch(() => null)
    if (!resp.ok || !payload?.consent_url) throw new Error(payload?.error || 'Failed')
    clearSession(); window.location.replace(payload.consent_url); return true
  }
  const onVerify = async () => {
    if (code.length < 6 || loading) return
    setLoading(true); setError('')
    try {
      if (isEmailVerify) {
        const data = await verifyEmailCode(email, code); clearSession()
        if (data.access_token) { setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token }); navigate('/setup') }
        else navigate('/login?verified=1')
      } else {
        const data = verifyType === 'totp' ? await totpLoginVerify(email, code, siteId, redirectUrl, siteState) : await mfaVerify(email, code)
        setTokens({ accessToken: data.access_token, refreshToken: data.refresh_token })
        if (await continueOIDC(data.access_token)) return
        clearSession()
        const sid = data.site_id || siteId; const rurl = data.redirect_url || redirectUrl; const ss = data.site_state || siteState
        if (sid && rurl) { window.location.href = `/api/service/callback?site_id=${encodeURIComponent(sid)}&redirect_url=${encodeURIComponent(rurl)}&state=${encodeURIComponent(ss)}&token=${encodeURIComponent(data.access_token)}&refresh_token=${encodeURIComponent(data.refresh_token || '')}`; return }
        navigate('/')
      }
    } catch (e: unknown) {
      const errorCode = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || ''
      const errorMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || ''
      
      // Map error codes to user-friendly messages
      let message = errorMessage
      if (errorCode === 'invalid_code') {
        message = 'Invalid code. Please try again.'
      } else if (errorCode === 'code_expired') {
        message = 'Code has expired. Please request a new one.'
      } else if (errorCode === 'invalid_request') {
        message = 'Invalid request. Please try again.'
      } else if (errorCode === 'too_many_attempts') {
        message = 'Too many attempts. Please wait before trying again.'
      } else if (!message) {
        message = 'Invalid code. Please try again.'
      }
      
      setError(message)
      setDigits(Array(6).fill('')); refs.current[0]?.focus()
    } finally { setLoading(false) }
  }
  const onResend = async () => {
    if (loading || resendCooldown > 0) return
    setLoading(true); setError(''); setInfo('')
    try { await resendVerifyEmail(email); setInfo('Code sent — check your inbox.'); startCooldown(60) }
    catch (e: unknown) {
      const errorCode = (e as { response?: { data?: { error?: string } } })?.response?.data?.error || ''
      const errorMessage = (e as { response?: { data?: { message?: string } } })?.response?.data?.message || ''
      
      let message = errorMessage
      if (errorCode === 'rate_limit_exceeded') {
        message = 'Too many requests. Please wait a moment before trying again.'
      } else if (errorCode === 'email_not_found') {
        message = 'Email not found. Please try logging in again.'
      } else if (!message) {
        message = 'Failed to resend code. Please try again.'
      }
      
      setError(message)
    }
    finally { setLoading(false) }
  }


  return (
    <AuthShell
      desktopSimple
      backTo="/login"
      title={isEmailVerify ? 'Verify your email' : verifyType === 'totp' ? 'Authenticator code' : 'Check your email'}
      description={isEmailVerify ? `Enter the 6-digit code we sent to ${email}` : verifyType === 'totp' ? 'Enter the 6-digit code from your authenticator app.' : `Enter the 6-digit login code we sent to ${email}`}
    >
      {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
      {info && <AlertBanner tone="success" title={info} onDismiss={() => setInfo('')} />}
      <div className={styles.grid}>
        {digits.map((d, i) => (
          <input key={i} ref={el => (refs.current[i] = el)} type="text" inputMode="numeric" maxLength={6}
            value={d} onChange={e => onDigitChange(i, e.target.value)} onKeyDown={e => onKeyDown(i, e)} onFocus={e => e.target.select()} className={`${styles.input} ${d ? styles.inputFilled : ''}`} aria-label={`Code digit ${i + 1}`} />
        ))}
      </div>
      <Button className={styles.submit} disabled={code.length < 6 || loading} onClick={onVerify}>
        {loading ? <Spinner /> : 'Continue'}
      </Button>
      {verifyType !== 'totp' && (
        <div className={styles.actions}>
          <button type="button" onClick={onResend} disabled={resendCooldown > 0 || loading} className={styles.link}>
            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Send code again'}
          </button>
          {isEmailVerify ? <Link to="/login" className={styles.link}>Use a different email</Link> : null}
        </div>
      )}
    </AuthShell>
  )
}
