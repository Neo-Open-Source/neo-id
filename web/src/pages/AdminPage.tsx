import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button, AlertBanner, Spinner } from '@neo-open-source/ui-web'
import { clearTokens } from '../api/client'
import ResponsiveLayout from '../components/ResponsiveLayout'
import { logout } from '../api/endpoints'
import { useCachedProfile } from '../hooks/useCachedProfile'
import { buildAppNav } from '../navigation/appNav'
import styles from '../styles/AdminPage.module.css'
import { useAdminPageState } from '../hooks/useAdminPageState'
import AdminUsersTab from '../components/admin/AdminUsersTab'
import AdminServicesTab from '../components/admin/AdminServicesTab'
import AdminSitesTab from '../components/admin/AdminSitesTab'
import BanUserModal from '../components/admin/BanUserModal'

const TABS = ['Users', 'Services', 'Registered services']

export default function AdminPage() {
  const navigate = useNavigate()
  const { profile } = useCachedProfile()
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
  const {
    tab,
    setTab,
    users,
    usersSearch,
    setUsersSearch,
    usersLoading,
    usersBannedOnly,
    setUsersBannedOnly,
    usersPage,
    usersPages,
    setUsersPage,
    banOpen,
    setBanOpen,
    banReason,
    setBanReason,
    banDuration,
    setBanDuration,
    services,
    servicesLoading,
    newService,
    setNewService,
    sites,
    sitesLoading,
    legalNotifyLoading,
    loadUsers,
    loadSites,
    onChangeRole,
    onOpenBan,
    onConfirmBan,
    onUnban,
    onCreateService,
    onDeleteSite,
    onRunLegalNotifyBatch,
  } = useAdminPageState(!!allowed, notify)

  return (
    <ResponsiveLayout 
      useAppLayout 
      appLayoutProps={{ title: "Neo ID", profile: profile || undefined, navItems, onLogout: handleLogout, compact: true }}
      mobileTitle="Admin Panel"
      backTo="/"
    >
      <div className={styles.pageContent}>
        {msg.text && <div className={styles.message}><AlertBanner tone={msg.type === 'error' ? 'danger' : 'success'} title={msg.text} onDismiss={() => setMsg({ type: '', text: '' })} /></div>}

        {allowed === null ? (
          <div className={styles.loadingWrap}>
            <Spinner />
          </div>
        ) : !allowed ? <AlertBanner tone="warning" title="Admin or Moderator access required" /> : (
          <div>
            <div className={styles.header}>
              <h2 className={styles.pageHeading}>Admin Panel</h2>
              <Button variant="secondary" size="sm" disabled={legalNotifyLoading} onClick={onRunLegalNotifyBatch}>
                {legalNotifyLoading ? 'Running…' : 'Run legal notify batch'}
              </Button>
            </div>

            {/* Tabs */}
            <div className={styles.panel}>
              <div className={styles.tabsRow}>
                {TABS.map((t, i) => (
                  <button key={t} onClick={() => setTab(i)} className={`${styles.tabButton} ${tab === i ? styles.tabButtonActive : ''}`}>{t}</button>
                ))}
              </div>

              <div className={styles.panelBody}>
                {tab === 0 ? (
                  <AdminUsersTab
                    users={users}
                    usersSearch={usersSearch}
                    usersBannedOnly={usersBannedOnly}
                    usersLoading={usersLoading}
                    usersPage={usersPage}
                    usersPages={usersPages}
                    onSearchChange={setUsersSearch}
                    onSearch={() => {
                      setUsersPage(1)
                      void loadUsers()
                    }}
                    onSearchEnter={() => void loadUsers()}
                    onBannedOnlyChange={(value) => {
                      setUsersPage(1)
                      setUsersBannedOnly(value)
                    }}
                    onChangeRole={onChangeRole}
                    onBanClick={onOpenBan}
                    onUnban={onUnban}
                    onPrevPage={() => setUsersPage((p) => Math.max(1, p - 1))}
                    onNextPage={() => setUsersPage((p) => p + 1)}
                  />
                ) : null}

                {tab === 1 ? (
                  <AdminServicesTab
                    services={services}
                    servicesLoading={servicesLoading}
                    newService={newService}
                    onNewServiceChange={(patch) => setNewService((prev) => ({ ...prev, ...patch }))}
                    onCreateService={() => void onCreateService()}
                  />
                ) : null}

                {tab === 2 ? <AdminSitesTab sites={sites} sitesLoading={sitesLoading} onRefresh={() => void loadSites()} onDeleteSite={onDeleteSite} /> : null}
              </div>
            </div>
          </div>
        )}
      </div>
      <BanUserModal
        open={banOpen}
        reason={banReason}
        duration={banDuration}
        onClose={() => setBanOpen(false)}
        onReasonChange={setBanReason}
        onDurationChange={setBanDuration}
        onConfirm={() => void onConfirmBan()}
      />
    </ResponsiveLayout>
  )
}
