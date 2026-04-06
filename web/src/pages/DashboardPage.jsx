import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Box, Alert, Collapse } from '@mui/material'
import { User, Shield, Monitor, Code2 } from 'lucide-react'
import { clearTokens, getAccessToken } from '../api/client'
import AppLayout from '../components/AppLayout.jsx'
import ProfileSection from '../components/sections/ProfileSection.jsx'
import SecuritySection from '../components/sections/SecuritySection.jsx'
import ServicesSection from '../components/sections/ServicesSection.jsx'
import DeveloperSection from '../components/sections/DeveloperSection.jsx'
import {
  getProfile, getProviders, unlinkProvider,
  getServices, connectService, disconnectService,
  listServiceApps, createServiceApp, revokeServiceApp, deleteServiceApp,
  logout,
} from '../api/endpoints'

const Icons = {
  profile: <User size={15} />,
  security: <Shield size={15} />,
  services: <Monitor size={15} />,
  developer: <Code2 size={15} />,
}

export default function DashboardPage() {
  const navigate = useNavigate()
  const [activeSection, setActiveSection] = useState('profile')
  const [profile, setProfile] = useState(null)
  const [providers, setProviders] = useState([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState({ connected_services: [], available_services: [] })
  const [serviceApps, setServiceApps] = useState([])
  const [msg, setMsg] = useState({ type: '', text: '' })
  const token = getAccessToken()

  useEffect(() => { if (!token) navigate('/login') }, [token, navigate])

  const load = async () => {
    const p = await getProfile()
    setProfile(p)
    const pr = await getProviders()
    setProviders(pr.oauth_providers || [])
    setHasPassword(!!pr.has_password)
    const s = await getServices()
    setServices(s)
    const role = (p.role || '').toLowerCase()
    if (['developer', 'admin', 'moderator'].includes(role)) {
      const apps = await listServiceApps()
      setServiceApps(apps.service_apps || [])
    }
  }

  useEffect(() => { load().catch(() => navigate('/login')) }, [])

  const notify = (type, text) => {
    setMsg({ type, text })
    setTimeout(() => setMsg({ type: '', text: '' }), 4000)
  }

  const handleLogout = async () => { await logout(); clearTokens(); navigate('/login') }

  const onUnlink = async (p) => {
    try { await unlinkProvider(p); await logout(); clearTokens(); navigate('/login') }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onConnectService = async (n) => {
    try { await connectService(n); await load() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onDisconnectService = async (n) => {
    try { await disconnectService(n); await load() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onCreateServiceApp = async (name) => {
    const d = await createServiceApp(name)
    await load()
    return d
  }

  const onRevokeServiceApp = async (id) => {
    try { await revokeServiceApp(id); await load() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const onDeleteServiceApp = async (id) => {
    try { await deleteServiceApp(id); await load() }
    catch (e) { notify('error', e?.response?.data?.error || 'Failed') }
  }

  const role = (profile?.role || '').toLowerCase()
  const isDev = ['developer', 'admin', 'moderator'].includes(role)
  const isAdmin = ['admin', 'moderator'].includes(role)

  const navItems = [
    { id: 'profile', label: 'Profile', icon: Icons.profile },
    { id: 'security', label: 'Security', icon: Icons.security },
    { id: 'services', label: 'Services', icon: Icons.services },
    ...(isDev ? [{ id: 'developer', label: 'Developer', icon: Icons.developer }] : []),
  ].map(n => ({ ...n, active: activeSection === n.id, onClick: () => setActiveSection(n.id) }))

  const extraNav = [
    ...(isDev ? [{ label: 'Services', onClick: () => navigate('/services') }] : []),
    ...(isDev ? [{ label: 'Docs', onClick: () => navigate('/docs') }] : []),
    ...(isAdmin ? [{ label: 'Admin Panel', onClick: () => navigate('/admin') }] : []),
  ]

  return (
    <AppLayout
      title="Neo ID"
      profile={profile}
      navItems={navItems}
      extraNav={extraNav}
      onLogout={handleLogout}
    >
      <Box sx={{ p: { xs: 2, md: 4 }, maxWidth: 720 }}>
        <Collapse in={!!msg.text}>
          <Alert severity={msg.type || 'info'} sx={{ mb: 3, py: 0.5 }}>{msg.text}</Alert>
        </Collapse>

        {activeSection === 'profile' && (
          <ProfileSection
            profile={profile}
            notify={notify}
            onAvatarSaved={(newUrl) => setProfile((p) => ({ ...p, avatar: newUrl }))}
          />
        )}

        {activeSection === 'security' && (
          <SecuritySection
            profile={profile}
            providers={providers}
            hasPassword={hasPassword}
            notify={notify}
            onUnlink={onUnlink}
            onPasswordChanged={load}
          />
        )}

        {activeSection === 'services' && (
          <ServicesSection
            services={services}
            onConnect={onConnectService}
            onDisconnect={onDisconnectService}
          />
        )}

        {activeSection === 'developer' && (
          <DeveloperSection
            profile={profile}
            serviceApps={serviceApps}
            onCreateApp={onCreateServiceApp}
            onRevokeApp={onRevokeServiceApp}
            onDeleteApp={onDeleteServiceApp}
            onNavigateToServices={() => navigate('/services')}
          />
        )}
      </Box>
    </AppLayout>
  )
}
