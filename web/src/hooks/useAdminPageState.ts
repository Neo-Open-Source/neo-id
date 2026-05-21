import { useEffect, useState } from 'react'
import { adminBanUser, adminCreateService, adminGetServices, adminGetSites, adminGetTelemetry, adminGetUsers, adminRunLegalNotifyBatch, adminSetUserRole, adminUnbanUser } from '../api/endpoints'
import type { AdminNewServicePayload, AdminService, AdminSite, AdminUser, TelemetryEvent } from '../types/app'

interface NotifyFn {
  (type: string, text: string): void
}

export function useAdminPageState(enabled: boolean, notify: NotifyFn) {
  const [tab, setTab] = useState(0)

  const [users, setUsers] = useState<AdminUser[]>([])
  const [usersSearch, setUsersSearch] = useState('')
  const [usersLoading, setUsersLoading] = useState(false)
  const [usersBannedOnly, setUsersBannedOnly] = useState(false)
  const [usersPage, setUsersPage] = useState(1)
  const [usersPages, setUsersPages] = useState(1)
  const [banOpen, setBanOpen] = useState(false)
  const [banUserId, setBanUserId] = useState('')
  const [banReason, setBanReason] = useState('')
  const [banDuration, setBanDuration] = useState('permanent')

  const [services, setServices] = useState<AdminService[]>([])
  const [servicesLoading, setServicesLoading] = useState(false)
  const [newService, setNewService] = useState<AdminNewServicePayload>({ name: '', display_name: '', description: '' })

  const [sites, setSites] = useState<AdminSite[]>([])
  const [sitesLoading, setSitesLoading] = useState(false)
  const [telemetry, setTelemetry] = useState<TelemetryEvent[]>([])
  const [telemetryLoading, setTelemetryLoading] = useState(false)
  const [legalNotifyLoading, setLegalNotifyLoading] = useState(false)

  const loadUsers = async () => {
    setUsersLoading(true)
    try {
      const r = await adminGetUsers({
        page: usersPage,
        limit: 20,
        search: usersSearch || undefined,
        banned: usersBannedOnly ? 'true' : undefined,
      })
      setUsers(r.users || [])
      setUsersPages(r?.pagination?.pages || 1)
    } catch (e: unknown) {
      notify('error', (e as { message?: string })?.message || 'Failed')
    } finally {
      setUsersLoading(false)
    }
  }

  const loadServices = async () => {
    setServicesLoading(true)
    try {
      const r = await adminGetServices()
      setServices(r.services || [])
    } catch (e: unknown) {
      notify('error', (e as { message?: string })?.message || 'Failed')
    } finally {
      setServicesLoading(false)
    }
  }

  const loadSites = async () => {
    setSitesLoading(true)
    try {
      const r = await adminGetSites()
      setSites(r.sites || [])
    } catch (e: unknown) {
      notify('error', (e as { message?: string })?.message || 'Failed')
    } finally {
      setSitesLoading(false)
    }
  }

  const loadTelemetry = async () => {
    setTelemetryLoading(true)
    try {
      const r = await adminGetTelemetry(200)
      setTelemetry(r.events || [])
    } catch (e: unknown) {
      notify('error', (e as { message?: string })?.message || 'Failed')
    } finally {
      setTelemetryLoading(false)
    }
  }

  useEffect(() => {
    if (!enabled) return
    if (tab === 0) void loadUsers()
    else if (tab === 1) void loadServices()
    else if (tab === 2) void loadSites()
    else void loadTelemetry()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tab])

  useEffect(() => {
    if (!enabled || tab !== 0) return
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, tab, usersPage, usersBannedOnly])

  const onChangeRole = async (userId: string, role: string) => {
    try {
      await adminSetUserRole(userId, role)
      notify('success', 'Role updated')
      await loadUsers()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onOpenBan = (userId: string) => {
    setBanUserId(userId)
    setBanReason('')
    setBanDuration('permanent')
    setBanOpen(true)
  }

  const onConfirmBan = async () => {
    if (!banReason.trim()) {
      notify('error', 'Reason is required')
      return
    }
    try {
      await adminBanUser(banUserId, banReason.trim(), banDuration)
      notify('success', 'User banned')
      setBanOpen(false)
      await loadUsers()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onUnban = async (userId: string) => {
    try {
      await adminUnbanUser(userId)
      notify('success', 'User unbanned')
      await loadUsers()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onCreateService = async () => {
    try {
      await adminCreateService(newService)
      notify('success', 'Service created')
      setNewService({ name: '', display_name: '', description: '' })
      await loadServices()
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed')
    }
  }

  const onDeleteSite = async (siteId: string) => {
    if (!window.confirm('Delete this service?')) return
    try {
      const token = localStorage.getItem('accessToken')
      const res = await fetch('/api/service/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ site_id: siteId }),
      })
      if (!res.ok) {
        const e = (await res.json()) as { error?: string }
        throw new Error(e.error || 'Failed')
      }
      notify('success', 'Service deleted')
      await loadSites()
    } catch (e: unknown) {
      notify('error', (e as { message?: string })?.message || 'Failed')
    }
  }

  const onRunLegalNotifyBatch = async () => {
    setLegalNotifyLoading(true)
    try {
      const res = await adminRunLegalNotifyBatch()
      const sent = Number(res?.sent || 0)
      const failed = Number(res?.failed || 0)
      const skipped = Number(res?.skipped || 0)
      const hasMore = !!res?.has_more
      const version = res?.version || 'n/a'
      notify(
        failed > 0 ? 'error' : 'success',
        `Legal notify ${version}: sent ${sent}, failed ${failed}, skipped ${skipped}${hasMore ? '. More users pending, run again.' : ''}`,
      )
    } catch (e: unknown) {
      notify('error', (e as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to run legal notify batch')
    } finally {
      setLegalNotifyLoading(false)
    }
  }

  return {
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
    telemetry,
    telemetryLoading,
    legalNotifyLoading,
    loadUsers,
    loadSites,
    loadTelemetry,
    onChangeRole,
    onOpenBan,
    onConfirmBan,
    onUnban,
    onCreateService,
    onDeleteSite,
    onRunLegalNotifyBatch,
  }
}
