import { useRef, useState } from 'react'
import { AccountCard, AvatarPicker, Button } from '@neo-open-source/ui-web'
import Modal from '../Modal'
import { uploadAvatar, setAvatarStock, STOCK_AVATARS } from '../../api/endpoints'
import styles from '../../styles/ProfileSection.module.css'

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
      <div className={styles.header}>
        <h2 className={styles.title}>Profile</h2>
        <p className={styles.subtitle}>Your account information</p>
      </div>

      {/* AccountCard with clickable avatar overlay */}
      <div className={styles.cardWrap}>
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
          className={styles.avatarOverlay}
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
        <input ref={fileRef} type="file" accept="image/*" className={styles.hiddenInput} onChange={onFileChange} />
      </Modal>
    </div>
  )
}
