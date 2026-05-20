import { type ReactNode, useState } from 'react'
import { Avatar, ThemeToggle } from '@neo-open-source/ui-web'
import { Camera } from '@neo-open-source/icons'
import { useThemeMode } from '../app/ThemeContext'
import styles from '../styles/AppLayout.module.css'
import AvatarPickerDialog from './AvatarPickerDialog'

interface NavItem { 
  id?: string
  label: string
  icon?: ReactNode
  active?: boolean
  onClick: () => void
}

interface Profile { 
  avatar?: string
  display_name?: string
  first_name?: string
  last_name?: string
  email?: string
  role?: string
}

interface AppLayoutProps {
  title?: string
  profile?: Profile
  navItems?: NavItem[]
  extraNav?: NavItem[]
  onLogout?: () => void | Promise<void>
  children: ReactNode
  compact?: boolean
}

export default function AppLayout({ 
  title = 'Neo ID', 
  profile, 
  navItems = [], 
  extraNav = [], 
  onLogout, 
  children, 
  compact = false 
}: AppLayoutProps) {
  const { resolved, setMode } = useThemeMode()
  const dark = resolved === 'dark'
  const [showAvatarPicker, setShowAvatarPicker] = useState(false)
  const [avatarOverride, setAvatarOverride] = useState('')
  const avatarSrc = avatarOverride || profile?.avatar || (() => { 
    try { 
      return localStorage.getItem('neo_id_avatar_cache') || '' 
    } catch { 
      return '' 
    } 
  })()

  const sidebarWidth = compact ? 240 : 280
  const avatarSize = compact ? 56 : 64
  const fullName = [profile?.first_name, profile?.last_name].map(v => (v || '').trim()).filter(Boolean).join(' ')
  const preferredName = fullName || profile?.display_name || profile?.email || 'Neo User'

  return (
    <div className={styles.shell}>
      {/* Desktop sidebar */}
      <div className={styles.sidebar}>
        <aside className={styles.sidebarSurface} style={{ width: sidebarWidth }}>
          <div>
            <div className={styles.sidebarHeader}>{title}</div>
            {profile && (
              <div className={styles.sidebarProfile}>
                <div className={styles.avatarWrap}>
                  <button
                    type="button"
                    aria-label="Open avatar picker"
                    onClick={() => setShowAvatarPicker(true)}
                    style={{ border: 0, padding: 0, background: 'transparent', borderRadius: '50%', cursor: 'pointer' }}
                  >
                    <Avatar 
                      src={avatarSrc} 
                      fallback={preferredName[0]?.toUpperCase() || '?'} 
                      className={styles.avatar}
                      style={{ width: avatarSize, height: avatarSize }}
                    />
                  </button>
                  <button className={styles.avatarEdit} type="button" aria-label="Change avatar" onClick={() => setShowAvatarPicker(true)}>
                    <Camera size={13} />
                  </button>
                </div>
                <div className={styles.profileCopy}>
                  <p className={styles.profileName}>{preferredName}</p>
                  <p className={styles.profileEmail}>{profile.email || ''}</p>
                </div>
              </div>
            )}
          </div>

          <div className={styles.navContainer}>
            <div className={styles.navList}>
              {navItems.map((item, i) => (
                <button 
                  key={item.id ?? i} 
                  type="button" 
                  onClick={item.onClick} 
                  className={`${styles.navItem} ${item.active ? styles.navItemActive : ''}`}
                >
                  {item.icon && <span className={styles.navIcon}>{item.icon}</span>}
                  <span className={styles.navLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.themeToggleContainer}>
            <div className={styles.themeToggleInner}>
              <ThemeToggle dark={dark} onChange={v => setMode(v ? 'dark' : 'light')} />
            </div>
          </div>
        </aside>
      </div>

      {/* Main content */}
      <main className={styles.main} style={{ marginLeft: sidebarWidth }}>
        {children}
      </main>

      {profile ? (
        <AvatarPickerDialog
          open={showAvatarPicker}
          currentAvatar={avatarSrc}
          displayName={preferredName}
          onClose={() => setShowAvatarPicker(false)}
          onSaved={(url) => {
            setAvatarOverride(url)
            try { localStorage.setItem('neo_id_avatar_cache', url) } catch {}
          }}
        />
      ) : null}

      {/* Mobile navigation */}
      <div className={styles.mobileNavShell}>
        <div className={styles.mobileNav}>
          {navItems.map((item, i) => (
            <button 
              key={item.id ?? i} 
              type="button" 
              onClick={item.onClick} 
              className={`${styles.mobileNavItem} ${item.active ? styles.mobileNavItemActive : ''}`} 
              aria-label={item.label}
            >
              {item.icon}
            </button>
          ))}
          <button type="button" className={styles.mobileNavItem} aria-label="Profile">
            <Avatar 
              src={avatarSrc} 
              fallback={preferredName[0]?.toUpperCase() || '?'} 
              className={styles.mobileNavAvatar} 
            />
          </button>
        </div>
      </div>
    </div>
  )
}
