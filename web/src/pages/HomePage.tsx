import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Avatar, Spinner } from '@neo-open-source/ui-web'
import { ChevronRight, Code, Command, Settings as SettingsIcon, Shield, Camera } from '@neo-open-source/icons'
import MobilePageShell from '../components/MobilePageShell'
import AvatarPickerDialog from '../components/AvatarPickerDialog'
import { getAccessToken } from '../api/client'
import { getProfile } from '../api/endpoints'
import type { UserProfile } from '../types/app'
import styles from '../styles/HomePage.module.css'

export default function HomePage() {
  const navigate = useNavigate()
  const token = getAccessToken()
  const [profile, setProfile] = useState<UserProfile | null>(null)
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
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!token) return null

  const handleAvatarSaved = (url: string) => {
    setProfile(prev => prev ? { ...prev, avatar: url } : null)
  }

  const role = (profile?.role || '').toLowerCase()
  const fullName = [profile?.first_name, profile?.last_name]
    .map(v => (v || '').trim())
    .filter(Boolean)
    .join(' ')
  const preferredName = fullName || profile?.display_name || profile?.email || 'Neo User'
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
          <div className={styles.skeleton}>
            <div className={styles.skeletonSpinner}>
              <Spinner />
            </div>
            <div className={styles.skeletonAvatar} />
            <div className={styles.skeletonName} />
            <div className={styles.skeletonEmail} />
            <div className={styles.skeletonMenu}>
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className={styles.skeletonRow} />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className={styles.profile}>
              <div className={styles.avatarWrap}>
                <Avatar src={profile?.avatar || ''} fallback={preferredName[0]?.toUpperCase() || '?'} className={styles.avatar} />
                <button type="button" className={styles.avatarEdit} onClick={() => setShowAvatarPicker(true)} aria-label="Change avatar">
                  <Camera size={16} />
                </button>
              </div>
              <h1>{preferredName}</h1>
              <p>{profile?.email || ''}</p>
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
          currentAvatar={profile?.avatar || ''}
          displayName={preferredName}
          onClose={() => setShowAvatarPicker(false)}
          onSaved={handleAvatarSaved}
        />
      )}
    </MobilePageShell>
  )
}
