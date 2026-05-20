import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner, Button, Spinner } from '@neo-open-source/ui-web'
import { ChevronLeft } from '@neo-open-source/icons'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import Modal from '../components/Modal'
import SecuritySection from '../components/sections/SecuritySection'
import ServicesSection from '../components/sections/ServicesSection'
import { deleteAccountRequest, getProfile, getProviders, unlinkProvider, getServices, connectService, disconnectService, logout } from '../api/endpoints'
import { buildAppNav } from '../navigation/appNav'
import styles from '../styles/DashboardPage.module.css'

const VALID = ['security', 'apps']
const PROFILE_CACHE_KEY = 'neo_id_profile_cache'
const getHash = () => {
  const h = window.location.hash.replace('#', '')
  return VALID.includes(h) ? h : 'security'
}

type Profile = Record<string, unknown>

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(getHash)
  const readCachedProfile = (): Profile | null => {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_CACHE_KEY) || '') as Profile
    } catch {
      return null
    }
  }
  const [profile, setProfile] = useState<Profile | null>(() => readCachedProfile())
  const [providers, setProviders] = useState<unknown[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState<{ connected_services?: unknown[]; available_services?: unknown[] }>({})
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(() => !readCachedProfile())
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => { window.location.hash = activeSection }, [activeSection])
  useEffect(() => {
    const onHashChange = () => setActiveSection(getHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const load = async () => {
    if (!profile) setLoading(true)
    try {
      const p = await getProfile()
      setProfile(p)
      if (p?.avatar) {
        try { localStorage.setItem('neo_id_avatar_cache', p.avatar) } catch {}
      }
      try { localStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(p)) } catch {}
      const pr = await getProviders()
      setProviders(pr.oauth_providers || [])
      setHasPassword(!!pr.has_password)
      setServices(await getServices())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load().catch(() => navigate('/login'))
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('2fa_reload')) {
      sessionStorage.removeItem('2fa_reload')
      load().catch(() => {})
    }
    const params = new URLSearchParams(window.location.search)
    if (params.get('email_changed') === '1') {
      notify('success', 'Email updated successfully')
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const notify = (type: string, text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const handleLogout = async () => {
    await logout()
    clearTokens()
    navigate('/login')
  }

  const onUnlink = async (p: string) => {
    try {
      await unlinkProvider(p)
      await logout()
      clearTokens()
      navigate('/login')
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onConnectService = async (n: string) => {
    try {
      await connectService(n)
      await load()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onDisconnectService = async (n: string) => {
    try {
      await disconnectService(n)
      await load()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onDeleteAccount = async () => {
    setDeleteLoading(true)
    try {
      await deleteAccountRequest()
      setDeleteModalOpen(false)
      notify('success', 'Account deletion request sent')
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    } finally {
      setDeleteLoading(false)
    }
  }

  const role = ((profile?.role as string) || '').toLowerCase()
  const navItems = buildAppNav(role, 'settings', navigate).map((item) =>
    item.id === 'settings' ? { ...item, onClick: () => setActiveSection('security') } : item
  )

  const extraNav: { label: string; onClick: () => void }[] = []

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case 'profile': return 'Profile'
      case 'security': return 'Settings'
      case 'apps': return 'Apps and agents'
      default: return 'Settings'
    }
  }, [activeSection])

  if (loading && !profile) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--neo-bg-canvas)' }}>
        <Spinner />
      </div>
    )
  }

  return (
    <>
      <ResponsiveLayout 
        useAppLayout 
        appLayoutProps={{ title: "Neo ID", profile: profile as never, navItems, extraNav, onLogout: undefined, compact: true }}
        mobileTitle={sectionTitle}
        backTo="/"
      >
        <div className={styles.shell} data-section={activeSection}>
          {msg.text && (
            <div className={styles.alert}>
              <AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} />
            </div>
          )}

          <div className={styles.header}>
            {activeSection !== 'security' ? (
              <button
                type="button"
                onClick={() => setActiveSection('security')}
                className={styles.back}
              >
                <ChevronLeft size={16} />
                <span>Back to settings</span>
              </button>
            ) : null}
            <h1 className={styles.title}>{sectionTitle}</h1>
          </div>

          <div>
            {activeSection === 'security' && <SecuritySection profile={profile as never} providers={providers as never} hasPassword={hasPassword} notify={notify} onUnlink={onUnlink} onPasswordChanged={load} onOpenApps={() => setActiveSection('apps')} onDeleteAccount={() => setDeleteModalOpen(true)} onLogout={handleLogout} />}
            {activeSection === 'apps' && <ServicesSection services={services as never} onConnect={onConnectService} onDisconnect={onDisconnectService} />}
          </div>
        </div>
      </ResponsiveLayout>

      <Modal
        open={deleteModalOpen}
        onClose={() => !deleteLoading && setDeleteModalOpen(false)}
        title="Request to delete?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteModalOpen(false)} disabled={deleteLoading}>Cancel</Button>
            <Button variant="danger" onClick={onDeleteAccount} disabled={deleteLoading}>{deleteLoading ? 'Sending…' : 'Send request'}</Button>
          </>
        }
      >
        <p style={{ margin: 0, color: 'var(--neo-text-muted)' }}>You'll receive an email to confirm.</p>
      </Modal>

    </>
  )
}
