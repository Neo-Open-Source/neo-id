import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Spinner } from '@neo-open-source/ui-web'
import { ChevronRight, Code, Command, Settings as SettingsIcon, Shield, Camera } from '@neo-open-source/icons'
import MobilePageShell from '../components/MobilePageShell'
import AvatarPickerDialog from '../components/AvatarPickerDialog'
import { getAccessToken } from '../api/client'
import { getProfile } from '../api/endpoints'
import styles from '../styles/HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const token = getAccessToken()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)

  useEffect(() => {
    if (!token) { navigate('/login', { replace: true }); return }
    if (window.innerWidth > 768) {
      navigate('/dashboard', { replace: true })
      return
    }
    setLoading(true)
    getProfile().then(setProfile).catch(() => {}).finally(() => setLoading(false))
  }, [token, navigate])

  if (!token) return null

  const handleAvatarSaved = (url: string) => {
    setProfile(prev => prev ? { ...prev, avatar: url } : null)
  }

  const role = ((profile?.role as string) || '').toLowerCase()
  const fullName = [profile?.first_name as string, profile?.last_name as string]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .join(' ')
  const preferredName = fullName || (profile?.display_name as string) || (profile?.email as string) || 'Neo User'
  const items = [
    { label: 'Settings', icon: <SettingsIcon size={18} />, onClick: () => navigate('/dashboard') },
    { label: 'Services', icon: <Command size={18} />, onClick: () => navigate('/services') },
    ...(['developer', 'admin', 'moderator'].includes(role) ? [{ label: 'Developer', icon: <Code size={18} />, onClick: () => navigate('/developer') }] : []),
    ...(['admin', 'moderator'].includes(role) ? [{ label: 'Admin', icon: <Shield size={18} />, onClick: () => navigate('/admin') }] : []),
  ]

  return (
    <MobilePageShell>
      <div className={styles.container}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 24 }}>
            <div style={{ display: 'grid', placeItems: 'center', padding: '8px 0 4px' }}>
              <Spinner />
            </div>
            <div style={{ margin: '0 auto', width: 92, height: 92, borderRadius: '50%', background: 'var(--neo-surface-2)' }} />
            <div style={{ margin: '0 auto', width: 160, height: 20, borderRadius: 8, background: 'var(--neo-surface-2)' }} />
            <div style={{ margin: '0 auto', width: 220, height: 14, borderRadius: 8, background: 'var(--neo-surface-2)' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} style={{ height: 52, borderRadius: 12, background: 'var(--neo-surface-2)' }} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.profile}>
              <div className={styles.avatarWrap}>
                <Avatar src={(profile?.avatar as string) || ''} fallback={preferredName[0]?.toUpperCase() || '?'} className={styles.avatar} />
                <button type="button" className={styles.avatarEdit} onClick={() => setShowAvatarPicker(true)} aria-label="Change avatar">
                  <Camera size={16} />
                </button>
              </div>
              <h1>{preferredName}</h1>
              <p>{(profile?.email as string) || ''}</p>
            </div>

            <div className={styles.menu}>
              {items.map((item) => (
                <button key={item.label} type="button" className={styles.menuItem} onClick={item.onClick}>
                  <span className={styles.menuLeft}>
                    <span className={styles.menuIcon}>{item.icon}</span>
                    <span>{item.label}</span>
                  </span>
                  <ChevronRight size={18} />
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {!loading && (
        <AvatarPickerDialog
          open={showAvatarPicker}
          currentAvatar={(profile?.avatar as string) || ''}
          displayName={preferredName}
          onClose={() => setShowAvatarPicker(false)}
          onSaved={handleAvatarSaved}
        />
      )}
    </MobilePageShell>
  )
}
