import { useRef, useState } from 'react'
import { AccountCard, AvatarPicker, Button } from '@neo-open-source/ui-web'
import Modal from '../Modal'
import { uploadAvatar, setAvatarStock, STOCK_AVATARS } from '../../api/endpoints'

interface Profile { avatar?: string; display_name?: string; email?: string; role?: string; unified_id?: string }

const CACHE_KEY = 'neo_id_avatar_cache'
const getCached = () => { try { return localStorage.getItem(CACHE_KEY) || '' } catch { return '' } }
const setCached = (url: string) => { try { if (url) localStorage.setItem(CACHE_KEY, url); else localStorage.removeItem(CACHE_KEY) } catch {} }

export default function ProfileSection({ profile, notify, onAvatarSaved }: { profile?: Profile; notify?: (t: string, m: string) => void; onAvatarSaved?: (url: string) => void }) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selected, setSelected] = useState('')
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const avatarSrc = profile?.avatar || getCached()

  const onUpload = () => fileRef.current?.click()
  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setLoading(true)
    try {
      const data = await uploadAvatar(file)
      setCached(data.avatar); onAvatarSaved?.(data.avatar); notify?.('success', 'Avatar updated')
      setPickerOpen(false)
    } catch { notify?.('error', 'Upload failed') }
    finally { setLoading(false); e.target.value = '' }
  }
  const onSave = async () => {
    if (!selected) { setPickerOpen(false); return }
    setLoading(true)
    try {
      const data = await setAvatarStock(selected)
      setCached(data.avatar); onAvatarSaved?.(data.avatar); notify?.('success', 'Avatar updated')
      setPickerOpen(false); setSelected('')
    } catch { notify?.('error', 'Failed') }
    finally { setLoading(false) }
  }

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontWeight: 600, fontSize: '1.1rem' }}>Profile</h2>
        <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--neo-text-muted)' }}>Your account information</p>
      </div>

      {/* AccountCard with clickable avatar overlay */}
      <div style={{ maxWidth: 480, position: 'relative' }}>
        <AccountCard
          avatar={avatarSrc}
          name={profile?.display_name || profile?.email || ''}
          email={profile?.email || ''}
          role={profile?.role || 'User'}
          neoId={profile?.unified_id}
          className="neo-id-profile-card"
        />
        {/* Camera overlay on avatar */}
        <button
          onClick={() => setPickerOpen(true)}
          className="neo-id-avatar-overlay"
          aria-label="Change avatar"
        />
      </div>

      <Modal
        open={pickerOpen}
        onClose={() => { setPickerOpen(false); setSelected('') }}
        title="Change avatar"
        footer={<>
          <Button variant="ghost" size="sm" onClick={() => { setPickerOpen(false); setSelected('') }}>Cancel</Button>
          <Button size="sm" disabled={loading} onClick={onSave}>{loading ? 'Saving…' : 'Save'}</Button>
        </>}
      >
        <AvatarPicker
          currentAvatar={avatarSrc}
          displayName={profile?.display_name || profile?.email || ''}
          stockAvatars={STOCK_AVATARS}
          selected={selected}
          onSelect={setSelected}
          onUpload={onUpload}
        />
        <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onFileChange} />
      </Modal>

      <style>{`
        .neo-id-profile-card .neo-account-card__avatar { cursor: pointer; }
        .neo-id-avatar-overlay {
          position: absolute;
          top: 28px;
          left: 50%;
          transform: translateX(-50%);
          width: 88px;
          height: 88px;
          border-radius: 50%;
          border: none;
          background: transparent;
          cursor: pointer;
          transition: background 0.15s;
        }
        .neo-id-avatar-overlay:hover {
          background: rgba(0,0,0,0.4);
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z'/%3E%3Ccircle cx='12' cy='13' r='4'/%3E%3C/svg%3E");
          background-repeat: no-repeat;
          background-position: center;
        }
      `}</style>
    </div>
  )
}
