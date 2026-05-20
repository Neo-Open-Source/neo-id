import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner } from '@neo-open-source/ui-web'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import DeveloperSection from '../components/sections/DeveloperSection'
import { logout } from '../api/endpoints'
import { useCachedProfile } from '../hooks/useCachedProfile'
import { buildAppNav } from '../navigation/appNav'
import styles from '../styles/DeveloperPage.module.css'

export default function DeveloperPage() {
  const navigate = useNavigate()
  const { profile, loading } = useCachedProfile()

  const role = ((profile?.role as string) || '').toLowerCase()
  const hasAccess = ['developer', 'admin', 'moderator'].includes(role)

  useEffect(() => {
    if (!loading && profile && !hasAccess) navigate('/dashboard', { replace: true })
  }, [loading, profile, hasAccess, navigate])

  const handleLogout = async () => {
    await logout()
    clearTokens()
    navigate('/login')
  }
  void handleLogout

  if (!loading && !hasAccess) return <AlertBanner tone="warning" title="Access denied" />

  const navItems = buildAppNav(role, 'developer', navigate)

  return (
    <ResponsiveLayout
      useAppLayout
      appLayoutProps={{ title: 'Neo ID', profile: profile || undefined, navItems, onLogout: undefined, compact: true }}
      mobileTitle="Developer"
      backTo="/"
    >
      <div className={styles.container}>
        {profile && <DeveloperSection profile={profile} onNavigateToServices={() => navigate('/services')} />}
      </div>
    </ResponsiveLayout>
  )
}
