import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, Input, AlertBanner, Avatar, Badge, Spinner } from '@neo-open-source/ui-web'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import Modal from '../components/Modal'
import { adminGetUsers, adminSetUserRole, adminBanUser, adminUnbanUser, adminGetServices, adminCreateService, adminGetSites, logout } from '../api/endpoints'
import { useCachedProfile } from '../hooks/useCachedProfile'
import { buildAppNav } from '../navigation/appNav'

interface User { unified_id: string; display_name?: string; email?: string; avatar?: string; role?: string; is_banned?: boolean }
interface Service { name: string; display_name?: string; description?: string; is_active?: boolean }
interface Site { site_id: string; name: string; domain?: string; owner_email?: string; plan?: string; is_active?: boolean }

const TABS = ['Users', 'Services', 'Registered services']

export default function AdminPage() {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(false)
  const { profile } = useCachedProfile()
  const [tab, setTab] = useState(0)
  const [msg, setMsg] = useState({ type: '', text: '' })

  const allowed = useMemo(() => {
    if (!profile) return null
    const r = ((profile?.role as string) || 'user').toLowerCase()
    return r === 'admin' || r === 'moderator'
  }, [profile])
  const notify = (type: string, text: string) => { setMsg({ type, text }); setTimeout(() => setMsg({ type: '', text: '' }), 4000) }
  const handleLogout = async () => { await logout(); clearTokens(); navigate('/login') }
  const role = ((profile?.role as string) || '').toLowerCase()
  const navItems = buildAppNav(role, 'admin', navigate)

  // Users
  const [users, setUsers] = useState<User[]>([])
  const [usersSearch, setUsersSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersBannedOnly, setUsersBannedOnly] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersPages, setUsersPages] = useState(1)
  const [banOpen, setBanOpen] = useState(false)
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('permanent')

  // Services
  const [services, setServices] = useState<Service[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [newService, setNewService] = useState({ name: '', display_name: '', description: '' })

  // Sites
  const [sites, setSites] = useState<Site[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)

  const loadUsers = async () => {
    setUsersLoading(true)
    try { const r = await adminGetUsers({ page: usersPage, limit: 20, search: usersSearch || undefined, banned: usersBannedOnly ? 'true' : undefined }); setUsers(r.users || []); setUsersPages(r?.pagination?.pages || 1) }
    catch (e: unknown) { notify('error', (e as { message?: string })?.message || 'Failed') }
    finally { setUsersLoading(false) }
  }
  const loadServices = async () => {
    setServicesLoading(true)
    try { const r = await adminGetServices(); setServices(r.services || []) } catch (e: unknown) { notify('error', (e as { message?: string })?.message || 'Failed') }
    finally { setServicesLoading(false) }
  }
  const loadSites = async () => {
    setSitesLoading(true)
    try { const r = await adminGetSites(); setSites(r.sites || []) } catch (e: unknown) { notify('error', (e as { message?: string })?.message || 'Failed') }
    finally { setSitesLoading(false) }
  }

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])
  useEffect(() => { if (!allowed) return; if (tab === 0) loadUsers(); else if (tab === 1) loadServices(); else loadSites() }, [allowed, tab])
  useEffect(() => { if (!allowed || tab !== 0) return; loadUsers() }, [usersPage, usersBannedOnly])

  const onChangeRole = async (user_id: string, role: string) => {
    try { await adminSetUserRole(user_id, role); notify('success', 'Role updated'); await loadUsers() }
    catch (e: unknown) { notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  }
  const confirmBan = async () => {
    if (!banReason.trim()) { notify('error', 'Reason is required'); return }
    try { await adminBanUser(banUserId, banReason.trim(), banDuration); notify('success', 'User banned'); setBanOpen(false); await loadUsers() }
    catch (e: unknown) { notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  }
  const onUnban = async (user_id: string) => {
    try { await adminUnbanUser(user_id); notify('success', 'User unbanned'); await loadUsers() }
    catch (e: unknown) { notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  }
  const onCreateService = async () => {
    try { await adminCreateService(newService as Record<string, unknown>); notify('success', 'Service created'); setNewService({ name: '', display_name: '', description: '' }); await loadServices() }
    catch (e: unknown) { notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed') }
  }
  const onDeleteSite = async (siteId: string) => {
    if (!window.confirm('Delete this service?')) return
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/service/delete', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify({ site_id: siteId }) })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error) }
      notify('success', 'Service deleted'); await loadSites()
    } catch (e: unknown) { notify('error', (e as { message?: string })?.message || 'Failed') }
  }

  const selectStyle: React.CSSProperties = { height: 28, padding: '0 6px', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontSize: 13, cursor: 'pointer', flexShrink: 0 }

  return (
    <ResponsiveLayout 
      useAppLayout 
      appLayoutProps={{ title: "Neo ID", profile: profile as never, navItems, onLogout: handleLogout, compact: true }}
      mobileTitle="Admin Panel"
      backTo="/"
    >
      <div className="admin-page-content">
        {msg.text && <div style={{ marginBottom: 16 }}><AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} /></div>}

        {allowed === null ? (
          <div style={{ minHeight: 220, display: 'grid', placeItems: 'center' }}>
            <Spinner />
          </div>
        ) : !allowed ? <AlertBanner tone="warning" title="Admin or Moderator access required" /> : (
          <div>
            <h2 className="admin-page-heading" style={{ margin: '0 0 16px', fontWeight: 600, fontSize: '1.1rem' }}>Admin Panel</h2>

            {/* Tabs */}
            <div style={{ background: 'var(--neo-surface-2)', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-md)', overflow: 'hidden' }}>
              <div className="admin-tabs-row" style={{ display: 'flex', borderBottom: '1px solid var(--neo-border-subtle)', padding: isMobile ? '0 8px' : '0 16px', overflowX: isMobile ? 'auto' : 'visible', gap: isMobile ? 2 : 0 }}>
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: isMobile ? '12px 10px' : '12px 12px', whiteSpace: 'nowrap', fontSize: isMobile ? 13 : 14, fontWeight: tab === i ? 600 : 400, color: tab === i ? 'var(--neo-text-primary)' : 'var(--neo-text-muted)', borderBottom: `2px solid ${tab === i ? 'var(--neo-text-primary)' : 'transparent'}`, marginBottom: -1 }}>{t}</button>
                ))}
              </div>

              <div style={{ padding: isMobile ? 12 : 20 }}>
                {/* Users */}
                {tab === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto', gap: 10, alignItems: 'center' }}>
                      <Input placeholder="Search by email or name…" value={usersSearch} onChange={e => setUsersSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && loadUsers()} style={{ flex: 1, minWidth: isMobile ? 0 : 200, width: isMobile ? '100%' : 'auto' }} />
                      <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 14, cursor: 'pointer', justifySelf: isMobile ? 'start' : 'auto' }}>
                        <input type="checkbox" checked={usersBannedOnly} onChange={e => { setUsersPage(1); setUsersBannedOnly(e.target.checked) }} />
                        Banned
                      </label>
                      <Button variant="secondary" size="sm" disabled={usersLoading} onClick={() => { setUsersPage(1); loadUsers() }} style={{ width: isMobile ? '100%' : 'auto' }}>Search</Button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {users.map((u, i) => (
                        <div key={u.unified_id} style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', gap: 10, flexWrap: isMobile ? 'wrap' : 'nowrap', padding: isMobile ? '12px 8px' : '10px 8px', borderBottom: i < users.length - 1 ? '1px solid var(--neo-border-subtle)' : 'none' }}>
                          <Avatar className="neo-id-avatar-sm" src={u.avatar || ''} fallback={(u.display_name || u.email || '?')[0].toUpperCase()} />
                          <div style={{ flex: 1, minWidth: isMobile ? 'calc(100% - 42px)' : 0 }}>
                            <p style={{ margin: 0, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.display_name || '—'}</p>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr 1fr' : 'auto auto auto', gap: 8, alignItems: 'center', marginLeft: isMobile ? 42 : 0, width: isMobile ? 'calc(100% - 42px)' : 'auto', flexWrap: 'wrap' }}>
                            <Badge className={u.is_banned ? 'admin-status-badge admin-status-badge--banned' : 'admin-status-badge admin-status-badge--active'} tone={u.is_banned ? undefined : 'success'} style={{ flexShrink: 0 }}>{u.is_banned ? 'Banned' : 'Active'}</Badge>
                            <select value={u.role || 'User'} onChange={e => onChangeRole(u.unified_id, e.target.value)} style={{ ...selectStyle, minWidth: isMobile ? 96 : undefined, width: isMobile ? '100%' : undefined }}>
                            {['User', 'Developer', 'Moderator', 'Admin'].map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                            {!u.is_banned
                              ? <Button variant="danger" size="sm" onClick={() => { setBanUserId(u.unified_id); setBanReason(''); setBanDuration('permanent'); setBanOpen(true) }} style={{ width: isMobile ? '100%' : undefined }}>Ban</Button>
                              : <Button variant="secondary" size="sm" onClick={() => onUnban(u.unified_id)} style={{ width: isMobile ? '100%' : undefined }}>Unban</Button>}
                          </div>
                        </div>
                      ))}
                      {users.length === 0 && <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center', padding: '24px 0' }}>No users found</p>}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
                      <span style={{ fontSize: 13, color: 'var(--neo-text-muted)' }}>Page {usersPage} / {usersPages}</span>
                      <Button variant="secondary" size="sm" disabled={usersLoading || usersPage <= 1} onClick={() => setUsersPage(p => Math.max(1, p - 1))}>Prev</Button>
                      <Button variant="secondary" size="sm" disabled={usersLoading || usersPage >= usersPages} onClick={() => setUsersPage(p => p + 1)}>Next</Button>
                    </div>
                  </div>
                )}

                {/* Services */}
                {tab === 1 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div style={{ background: 'var(--neo-surface-3)', borderRadius: 'var(--neo-radius-sm)', padding: 16 }}>
                      <p style={{ margin: '0 0 12px', fontWeight: 600, fontSize: 14 }}>Create service</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <Input placeholder="Name" value={newService.name} onChange={e => setNewService({ ...newService, name: e.target.value })} />
                        <Input placeholder="Display name" value={newService.display_name} onChange={e => setNewService({ ...newService, display_name: e.target.value })} />
                        <Input placeholder="Description" value={newService.description} onChange={e => setNewService({ ...newService, description: e.target.value })} />
                        <Button size="sm" onClick={onCreateService} style={{ alignSelf: 'flex-start' }}>Create</Button>
                      </div>
                    </div>
                    {servicesLoading ? (
                      <div style={{ minHeight: 140, display: 'grid', placeItems: 'center' }}>
                        <Spinner />
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {!servicesLoading && services.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center', padding: '24px 0' }}>No services</p>
                        : services.map((s, i) => (
                          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 8px', borderBottom: i < services.length - 1 ? '1px solid var(--neo-border-subtle)' : 'none' }}>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 500, fontSize: 13, fontFamily: 'monospace' }}>{s.name}</p>
                              <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)' }}>{s.display_name}</p>
                            </div>
                            <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', flex: 1, display: 'none' }}>{s.description}</p>
                            <Badge className={s.is_active ? 'admin-status-badge admin-status-badge--active' : 'admin-status-badge admin-status-badge--inactive'} tone={s.is_active ? 'success' : undefined}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                          </div>
                        ))}
                    </div>
                  </div>
                )}

                {/* Sites */}
                {tab === 2 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                      <Button variant="secondary" size="sm" onClick={loadSites} disabled={sitesLoading}>Refresh</Button>
                    </div>
                    {sitesLoading ? (
                      <div style={{ minHeight: 140, display: 'grid', placeItems: 'center' }}>
                        <Spinner />
                      </div>
                    ) : null}
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      {!sitesLoading && sites.length === 0 ? <p style={{ margin: 0, fontSize: 14, color: 'var(--neo-text-muted)', textAlign: 'center', padding: '24px 0' }}>No registered services</p>
                        : sites.map((s, i) => (
                          <div key={s.site_id} style={{ display: 'flex', alignItems: isMobile ? 'flex-start' : 'center', flexWrap: isMobile ? 'wrap' : 'nowrap', gap: 12, padding: '10px 8px', borderBottom: i < sites.length - 1 ? '1px solid var(--neo-border-subtle)' : 'none' }}>
                            <div style={{ flex: 1.5, minWidth: 0 }}>
                              <p style={{ margin: 0, fontWeight: 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</p>
                              <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.domain}</p>
                            </div>
                            {!isMobile ? <p style={{ margin: 0, fontSize: 13, color: 'var(--neo-text-muted)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.owner_email}</p> : null}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: isMobile ? '100%' : 'auto', marginLeft: isMobile ? 0 : 'auto' }}>
                              <Badge>{s.plan || 'free'}</Badge>
                              <Badge className={s.is_active ? 'admin-status-badge admin-status-badge--active' : 'admin-status-badge admin-status-badge--inactive'} tone={s.is_active ? 'success' : undefined}>{s.is_active ? 'Active' : 'Inactive'}</Badge>
                              <Button variant="danger" size="sm" onClick={() => onDeleteSite(s.site_id)} style={{ marginLeft: isMobile ? 'auto' : 0 }}>Delete</Button>
                            </div>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <Modal open={banOpen} onClose={() => setBanOpen(false)} title="Ban user"
        footer={<><Button variant="ghost" size="sm" onClick={() => setBanOpen(false)}>Cancel</Button><Button variant="danger" size="sm" onClick={confirmBan}>Ban</Button></>}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="Reason" value={banReason} onChange={e => setBanReason(e.target.value)} autoFocus />
          <select value={banDuration} onChange={e => setBanDuration(e.target.value)} style={{ height: 36, padding: '0 8px', border: '1px solid var(--neo-border-subtle)', borderRadius: 'var(--neo-radius-sm)', background: 'var(--neo-surface-2)', color: 'var(--neo-text-primary)', fontSize: 14 }}>
            <option value="permanent">Permanent</option>
            <option value="168h">7 days</option>
            <option value="720h">30 days</option>
          </select>
        </div>
      </Modal>
      <style>{`
        .neo-id-avatar-sm{width:32px;height:32px;font-size:.75rem;flex-shrink:0;}
        .admin-page-content{padding:16px 24px;}
        .admin-tabs-row::-webkit-scrollbar{height:0;width:0;}
        .admin-status-badge {
          font-weight: 600;
          border: 1px solid transparent;
        }
        html[data-theme='light'] .admin-status-badge--active {
          background: #dcfce8 !important;
          color: #166534 !important;
          border-color: #9ed8b5 !important;
        }
        html[data-theme='light'] .admin-status-badge--inactive {
          background: #eef2f7 !important;
          color: #475569 !important;
          border-color: #d4dce7 !important;
        }
        html[data-theme='light'] .admin-status-badge--banned {
          background: #fee2e2 !important;
          color: #b91c1c !important;
          border-color: #f8b4b4 !important;
        }
        @media (max-width:768px) {
          .admin-page-content{padding:16px;}
          .admin-page-heading{display:none;}
        }
      `}</style>
    </ResponsiveLayout>
  )
}
