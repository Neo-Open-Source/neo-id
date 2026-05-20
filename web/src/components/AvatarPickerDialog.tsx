import { useRef, useState } from 'react'
import { Button, AlertBanner, Avatar } from '@neo-open-source/ui-web'
import Modal from './Modal'
import { uploadAvatar, setAvatarStock, STOCK_AVATARS } from '../api/endpoints'

const CameraIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
    <circle cx="12" cy="13" r="4"/>
  </svg>
)

interface Props {
  open: boolean
  currentAvatar?: string
  displayName?: string
  onClose: () => void
  onSaved: (url: string) => void
}

export default function AvatarPickerDialog({ open, currentAvatar, displayName, onClose, onSaved }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [selected, setSelected] = useState('')
  const [previewURL, setPreviewURL] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const preview = previewURL || selected || currentAvatar || ''

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadFile(file); setSelected(''); setPreviewURL(URL.createObjectURL(file))
  }

  const onSelectStock = (url: string) => { setSelected(url); setPreviewURL(url); setUploadFile(null) }

  const onSave = async () => {
    if (!uploadFile && !selected) { onClose(); return }
    setLoading(true); setError('')
    try {
      const data = uploadFile ? await uploadAvatar(uploadFile) : await setAvatarStock(selected)
      onSaved(data.avatar); onClose()
    } catch (e: unknown) {
      setError((e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to update avatar')
    } finally { setLoading(false) }
  }

  const handleClose = () => { setSelected(''); setPreviewURL(''); setUploadFile(null); setError(''); onClose() }

  return (
    <Modal open={open} onClose={handleClose} title="Change profile picture"
      footer={<>
        <Button variant="ghost" size="sm" onClick={handleClose}>Cancel</Button>
        <Button size="sm" disabled={loading || (!uploadFile && !selected)} onClick={onSave}>
          {loading ? 'Saving…' : 'Save'}
        </Button>
      </>}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {error && <AlertBanner tone="danger" title={error} onDismiss={() => setError('')} />}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <div style={{ position: 'relative', display: 'inline-flex' }}>
            <div style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              overflow: 'hidden',
              flexShrink: 0,
              background: 'var(--neo-surface-3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '2rem',
            }}>
              {preview ? (
                <img src={preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              ) : (
                <Avatar src="" fallback={(displayName || '?')[0]?.toUpperCase()} style={{ width: '100%', height: '100%' }} />
              )}
            </div>
            <button onClick={() => fileRef.current?.click()} style={{
              position: 'absolute', bottom: 0, right: 0, width: 26, height: 26,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '50%', border: '1px solid var(--neo-border-subtle)',
              background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', cursor: 'pointer',
            }}><CameraIcon /></button>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
          </div>
          <span style={{ fontSize: 12, color: 'var(--neo-text-muted)' }}>Click the camera icon to upload</span>
        </div>

        <div>
          <span style={{ display: 'block', marginBottom: 8, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--neo-text-muted)' }}>Or choose an avatar</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
            {STOCK_AVATARS.map((url) => (
              <div key={url} onClick={() => onSelectStock(url)} style={{
                aspectRatio: '1', borderRadius: '50%', overflow: 'hidden', cursor: 'pointer',
                border: `2.5px solid ${selected === url ? 'var(--neo-text-primary)' : 'transparent'}`,
                transition: 'border-color 0.15s',
              }}>
                <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  )
}
