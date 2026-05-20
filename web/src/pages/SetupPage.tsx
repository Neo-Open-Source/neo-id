import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, AlertBanner } from '@neo-open-source/ui-web'
import { Camera } from '@neo-open-source/icons'
import { completeProfile, uploadAvatar, STOCK_AVATARS } from '../api/endpoints'
import { getAccessToken } from '../api/client'
import AuthShell from '../components/AuthShell'

export default function SetupPage() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState(1)
  const [selectedAvatar, setSelectedAvatar] = useState('')
  const [previewURL, setPreviewURL] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (!getAccessToken()) { navigate('/login'); return null }

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploadFile(file); setSelectedAvatar(''); setPreviewURL(URL.createObjectURL(file))
  }

  const onFinish = async () => {
    if (!displayName.trim()) { setError('Please enter your name'); return }
    setLoading(true); setError('')
    try {
      let avatarURL = selectedAvatar
      if (uploadFile) { const data = await uploadAvatar(uploadFile); avatarURL = data.avatar }
      await completeProfile(displayName.trim(), avatarURL)
      navigate('/')
    } catch (e: unknown) { setError((e as { response?: { data?: { error?: string }; message?: string } })?.response?.data?.error || 'Something went wrong') }
    finally { setLoading(false) }
  }

  const avatar = previewURL || selectedAvatar

  return (
    <AuthShell title={step === 1 ? 'Set up your profile' : "What's your name?"} description={step === 1 ? 'Upload a photo or choose an avatar to finish your account.' : "This is how you'll appear across Neo ID."} backTo={step === 2 ? '/setup' : undefined}>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1, 2].map(s => <div key={s} style={{ height: 4, flex: 1, borderRadius: 999, background: s <= step ? 'var(--neo-text-primary)' : 'var(--neo-border-subtle)', transition: 'background 0.3s' }} />)}
      </div>

      {step === 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <div style={{ position: 'relative', display: 'inline-flex' }}>
              <div style={{ width: 112, height: 112, borderRadius: '50%', overflow: 'hidden', border: `2px solid ${avatar ? 'var(--neo-text-primary)' : 'var(--neo-border-subtle)'}`, background: 'var(--neo-surface-3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem' }}>
                {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : '?'}
              </div>
              <button onClick={() => fileRef.current?.click()} style={{ position: 'absolute', bottom: 2, right: 2, width: 32, height: 32, borderRadius: '50%', border: '1px solid var(--neo-border-subtle)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
            </div>
          </div>
          <div>
            <span style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neo-text-muted)' }}>Choose an avatar</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {STOCK_AVATARS.map(url => (
                <div key={url} onClick={() => { setSelectedAvatar(url); setPreviewURL(url); setUploadFile(null) }}
                  style={{ aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer', border: `2.5px solid ${selectedAvatar === url ? 'var(--neo-text-primary)' : 'transparent'}`, transition: 'border-color 0.15s' }}>
                  <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <Button onClick={() => setStep(2)} style={{ width: '100%' }}>Continue</Button>
            <Button variant="ghost" onClick={() => setStep(2)} style={{ width: '100%' }}>Skip for now</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <button onClick={() => setStep(1)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--neo-text-muted)', fontSize: 14, padding: 0, textAlign: 'left', width: 'fit-content' }}>Back</button>
          {avatar && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', border: '1px solid var(--neo-border-subtle)', flexShrink: 0 }}>
                <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </div>
              <span style={{ fontSize: 13, color: 'var(--neo-text-muted)' }}>Looking good</span>
            </div>
          )}
          {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
          <Input placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" autoFocus onKeyDown={e => e.key === 'Enter' && onFinish()} />
          <Button disabled={loading || !displayName.trim()} onClick={onFinish} style={{ width: '100%' }}>
            {loading ? 'Saving…' : 'Finish'}
          </Button>
        </div>
      )}
    </AuthShell>
  )
}
