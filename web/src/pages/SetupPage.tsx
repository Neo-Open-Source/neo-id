import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, AlertBanner } from '@neo-open-source/ui-web'
import { Camera } from '@neo-open-source/icons'
import { completeProfile, uploadAvatar, STOCK_AVATARS } from '../api/endpoints'
import { getAccessToken } from '../api/client'
import AuthShell from '../components/AuthShell'
import styles from '../styles/SetupPage.module.css'

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
      <div className={styles.progress}>
        {[1, 2].map(s => <div key={s} className={`${styles.progressStep} ${s <= step ? styles.progressStepActive : ''}`} />)}
      </div>

      {step === 1 && (
        <div className={styles.step}>
          <div className={styles.avatarCenter}>
            <div className={styles.avatarPickerWrap}>
              <div className={`${styles.avatarPreview} ${avatar ? styles.avatarPreviewActive : ''}`}>
                {avatar ? <img src={avatar} alt="" className={styles.avatarPreviewImg} /> : '?'}
              </div>
              <button onClick={() => fileRef.current?.click()} className={styles.avatarCameraButton}>
                <Camera size={14} />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className={styles.fileInput} onChange={onFileChange} />
            </div>
          </div>
          <div>
            <span className={styles.stockLabel}>Choose an avatar</span>
            <div className={styles.stockGrid}>
              {STOCK_AVATARS.map(url => (
                <div key={url} onClick={() => { setSelectedAvatar(url); setPreviewURL(url); setUploadFile(null) }}
                  className={`${styles.stockItem} ${selectedAvatar === url ? styles.stockItemActive : ''}`}>
                  <img src={url} alt="" className={styles.stockImg} />
                </div>
              ))}
            </div>
          </div>
          <div className={styles.actions}>
            <Button className={styles.fullButton} onClick={() => setStep(2)}>Continue</Button>
            <Button className={styles.fullButton} variant="ghost" onClick={() => setStep(2)}>Skip for now</Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className={styles.step}>
          <button onClick={() => setStep(1)} className={styles.backButton}>Back</button>
          {avatar && (
            <div className={styles.miniProfile}>
              <div className={styles.miniAvatar}>
                <img src={avatar} alt="" className={styles.miniAvatarImg} />
              </div>
              <span className={styles.miniText}>Looking good</span>
            </div>
          )}
          {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}
          <Input placeholder="Display name" value={displayName} onChange={e => setDisplayName(e.target.value)} autoComplete="name" autoFocus onKeyDown={e => e.key === 'Enter' && onFinish()} />
          <Button className={styles.fullButton} disabled={loading || !displayName.trim()} onClick={onFinish}>
            {loading ? 'Saving…' : 'Finish'}
          </Button>
        </div>
      )}
    </AuthShell>
  )
}
