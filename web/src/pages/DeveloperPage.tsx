import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner, Spinner } from '@neo-open-source/ui-web'
import { Code, Settings as SettingsIcon, Shield } from '@neo-open-source/icons'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import DeveloperSection from '../components/sections/DeveloperSection'
import { getProfile, logout } from '../api/endpoints'

type Profile = Record<string, unknown>

export default function DeveloperPage() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    getProfile()
      .then((p) => {
        const role = ((p?.role as string) || '').toLowerCase()
        if (!['developer', 'admin', 'moderator'].includes(role)) {
          navigate('/dashboard')
          return
        }
        setProfile(p)
      })
      .catch(() => navigate('/login'))
      .finally(() => setLoading(false))
  }, [navigate])

  const handleLogout = async () => {
    await logout()
    clearTokens()
    navigate('/login')
  }

  const role = ((profile?.role as string) || '').toLowerCase()
  const isAdmin = ['admin', 'moderator'].includes(role)

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--neo-bg-canvas)' }}>
        <Spinner />
      </div>
    )
  }

  if (!profile) {
    return <AlertBanner tone="warning" title="Access denied" />
  }

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
        <DeveloperSection profile={profile as never} onNavigateToServices={() => navigate('/services')} />
      </div>
    </ResponsiveLayout>
  )
}

