import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertBanner, Button, Spinner } from '@neo-open-source/ui-web'
import { ChevronLeft, Command, Settings as SettingsIcon, Shield } from '@neo-open-source/icons'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import Modal from '../components/Modal'
import SecuritySection from '../components/sections/SecuritySection'
import ServicesSection from '../components/sections/ServicesSection'
import { deleteAccountRequest, getProfile, getProviders, unlinkProvider, getServices, connectService, disconnectService, logout } from '../api/endpoints'

const VALID = ['security', 'apps']
const getHash = () => {
  const h = window.location.hash.replace('#', '')
  return VALID.includes(h) ? h : 'security'
}

type Profile = Record<string, unknown>

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState(getHash)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [providers, setProviders] = useState<unknown[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState<{ connected_services?: unknown[]; available_services?: unknown[] }>({})
  const [msg, setMsg] = useState({ type: '', text: '' })
  const [loading, setLoading] = useState(true)
  const [deleteModalOpen, setDeleteModalOpen] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)

  useEffect(() => { window.location.hash = activeSection }, [activeSection])
  useEffect(() => {
    const onHashChange = () => setActiveSection(getHash())
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const load = async () => {
    setLoading(true)
    try {
      const p = await getProfile()
      setProfile(p)
      if (p?.avatar) {
        try { localStorage.setItem('neo_id_avatar_cache', p.avatar) } catch {}
      }
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
  const isAdmin = ['admin', 'moderator'].includes(role)

  const navItems: { id: string; label: string; icon: JSX.Element; active: boolean; onClick: () => void }[] = [
    { id: 'security', label: 'Settings', icon: <SettingsIcon size={15} /> },
    ...(['developer', 'admin', 'moderator'].includes(role) ? [{ id: 'developer', label: 'Developer', icon: <Command size={15} />, onClick: () => navigate('/developer') }] : []),
    ...(isAdmin ? [{ id: 'admin', label: 'Admin Panel', icon: <Shield size={15} />, onClick: () => navigate('/admin') }] : []),
  ].map((n) => ({ ...n, active: activeSection === n.id, onClick: 'onClick' in n && n.onClick ? n.onClick : () => setActiveSection(n.id) }))

  const extraNav: { label: string; onClick: () => void }[] = []

  const sectionTitle = useMemo(() => {
    switch (activeSection) {
      case 'profile': return 'Profile'
      case 'security': return 'Settings'
      case 'apps': return 'Apps and agents'
      default: return 'Settings'
    }
  }, [activeSection])

  if (loading) {
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
        <div className="neo-id-dashboard-shell" data-section={activeSection} style={{ width: 'min(100%, 960px)', margin: '0 auto', padding: '40px 32px 80px' }}>
          {msg.text && (
            <div className="neo-id-dashboard-alert" style={{ marginBottom: 20 }}>
              <AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} />
            </div>
          )}

          <div className="neo-id-dashboard-header" style={{ marginBottom: 28 }}>
            {activeSection !== 'security' ? (
              <button
                type="button"
                onClick={() => setActiveSection('security')}
                className="neo-id-dashboard-back"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginBottom: 16, border: 0, borderRadius: 999, background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', padding: '10px 14px', cursor: 'pointer' }}
              >
                <ChevronLeft size={16} />
                <span>Back to settings</span>
              </button>
            ) : null}
            <h1 className="neo-id-dashboard-title" style={{ margin: 0, fontSize: 'clamp(2rem, 4vw, 2.8rem)', letterSpacing: '-0.05em', lineHeight: 1 }}>{sectionTitle}</h1>
          </div>

          <div style={{ animation: 'neoSettingsFade 220ms var(--neo-ease-spring)' }}>
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

      <style>{`
        @keyframes neoSettingsFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @media (max-width: 768px) {
          .neo-id-dashboard-shell {
            width: 100% !important;
            padding: 20px 16px 112px !important;
          }
          .neo-id-dashboard-alert {
            margin-bottom: 16px !important;
          }
          .neo-id-dashboard-header {
            margin-bottom: 20px !important;
          }
          .neo-id-dashboard-back {
            margin-bottom: 12px !important;
            background: var(--neo-surface-2) !important;
          }
          .neo-id-dashboard-header h1 {
            font-size: 2rem !important;
            letter-spacing: -0.04em !important;
          }
          .neo-id-dashboard-shell[data-section="security"] .neo-id-dashboard-title {
            display: none;
          }
        }
      `}</style>
    </>
  )
}
