import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner } from '@neo-open-source/ui-web'
import { Code, Settings as SettingsIcon, Shield } from '@neo-open-source/icons'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import DeveloperSection from '../components/sections/DeveloperSection'
import { logout } from '../api/endpoints'
import { useCachedProfile } from '../hooks/useCachedProfile'

export default function DeveloperPage() {
  const navigate = useNavigate()
  const { profile, loading } = useCachedProfile()

  const role = ((profile?.role as string) || '').toLowerCase()
  const isAdmin = ['admin', 'moderator'].includes(role)
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

  const navItems: { id: string; label: string; icon: JSX.Element; active: boolean; onClick: () => void }[] = [
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={15} />, active: false, onClick: () => navigate('/dashboard') },
    { id: 'developer', label: 'Developer', icon: <Code size={15} />, active: true, onClick: () => navigate('/developer') },
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: <Shield size={15} />, active: false, onClick: () => navigate('/admin') }] : []),
  ]

  return (
    <ResponsiveLayout
      useAppLayout
      appLayoutProps={{ title: 'Neo ID', profile: profile as never, navItems, onLogout: undefined, compact: true }}
      mobileTitle="Developer"
      backTo="/"
    >
      <div style={{ width: 'min(100%, 960px)', margin: '0 auto', padding: '24px 16px 96px' }}>
        {profile && <DeveloperSection profile={profile as never} onNavigateToServices={() => navigate('/services')} />}
      </div>
    </ResponsiveLayout>
  )
}

