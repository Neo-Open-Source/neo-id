import { useEffect, useState } from 'react'
import { Box, Stack, Typography, Button, Alert, Chip, Select, MenuItem } from '@mui/material'
import { getSessions, revokeSession, setRefreshDuration } from '../../api/endpoints'

function DeviceIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  )
}

function MobileIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  )
}

function formatDevice(ua) {
  if (!ua) return { name: 'Unknown device', mobile: false }
  const mobile = /iPhone|iPad|Android/.test(ua)
  if (/iPhone/.test(ua)) return { name: 'iPhone', mobile: true }
  if (/iPad/.test(ua)) return { name: 'iPad', mobile: true }
  if (/Android/.test(ua)) return { name: 'Android', mobile: true }
  if (/Mac/.test(ua)) return { name: 'Mac', mobile: false }
  if (/Windows/.test(ua)) return { name: 'Windows PC', mobile: false }
  if (/Linux/.test(ua)) return { name: 'Linux', mobile: false }
  return { name: 'Unknown device', mobile: false }
}

function formatBrowser(ua) {
  if (!ua) return ''
  if (/Edg\//.test(ua)) return 'Edge'
  if (/Chrome\//.test(ua) && !/Chromium/.test(ua)) return 'Chrome'
  if (/Firefox\//.test(ua)) return 'Firefox'
  if (/Safari\//.test(ua) && !/Chrome/.test(ua)) return 'Safari'
  return ''
}

function timeAgo(dateStr) {
  if (!dateStr) return ''
  const diff = Date.now() - new Date(dateStr).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30) return `${d}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatIP(ip) {
  if (!ip) return ''
  const clean = ip.replace(/:\d+$/, '').replace(/^\[/, '').replace(/\]$/, '')
  if (clean === '127.0.0.1' || clean === '::1' || clean === 'localhost') return 'Local'
  return clean
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

const DURATION_OPTIONS = [
  { value: 1, label: '1 month' },
  { value: 3, label: '3 months' },
  { value: 6, label: '6 months' },
  { value: 9, label: '9 months' },
]

export default function SessionsSection({ currentRefreshMonths = 1 }) {
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [revoking, setRevoking] = useState('')
  const [duration, setDuration] = useState(currentRefreshMonths || 1)
  const [durationSaving, setDurationSaving] = useState(false)
  const [durationSaved, setDurationSaved] = useState(false)

  // Sync duration when profile loads (initially currentRefreshMonths may be undefined)
  useEffect(() => {
    if (currentRefreshMonths && currentRefreshMonths !== duration) {
      setDuration(currentRefreshMonths)
    }
  }, [currentRefreshMonths])

  const load = async () => {
    setLoading(true)
    try {
      const data = await getSessions()
      setSessions((data.sessions || []).sort((a, b) => (b.is_current ? 1 : 0) - (a.is_current ? 1 : 0)))
    } catch (e) {
      setError('Failed to load sessions')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onRevoke = async (id) => {
    setRevoking(id)
    setError('')
    try {
      await revokeSession(id)
      setSessions((s) => s.filter((x) => x.id !== id))
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to revoke')
    } finally {
      setRevoking('')
    }
  }

  const onSaveDuration = async (val) => {
    setDuration(val)
    setDurationSaving(true)
    try {
      await setRefreshDuration(val)
      setDurationSaved(true)
      setTimeout(() => setDurationSaved(false), 2500)
    } catch (e) {
      setError(e?.response?.data?.error || 'Failed to save')
    } finally {
      setDurationSaving(false)
    }
  }

  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3 }}>
      <Stack spacing={2.5}>

        {/* Session duration setting */}
        <Box>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>Session duration</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            How long you stay signed in without using the service. Resets each time you sign in.
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Select
              size="small"
              value={duration}
              onChange={(e) => onSaveDuration(e.target.value)}
              disabled={durationSaving}
              sx={{ minWidth: 140, fontSize: '0.875rem' }}
            >
              {DURATION_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
              ))}
            </Select>
            {durationSaved && (
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 500 }}>Saved</Typography>
            )}
          </Stack>
        </Box>

        <Box sx={{ height: '1px', bgcolor: 'divider' }} />

        {/* Sessions list */}
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Active sessions</Typography>
            <Typography variant="caption" color="text.secondary">Devices currently signed in</Typography>
          </Box>
          <Button size="small" variant="outlined" onClick={load} disabled={loading} sx={{ fontSize: '0.75rem', height: 28 }}>
            Refresh
          </Button>
        </Stack>

        {error && <Alert severity="error" sx={{ py: 0.5 }}>{error}</Alert>}

        {loading ? (
          <Typography variant="body2" color="text.secondary">Loading...</Typography>
        ) : sessions.length === 0 ? (
          <Typography variant="body2" color="text.secondary">No active sessions</Typography>
        ) : (
          <Stack spacing={0}>
            {sessions.map((s, i) => {
              const { name: deviceName, mobile } = formatDevice(s.user_agent)
              const browser = formatBrowser(s.user_agent)
              const lastActive = s.last_used_at || s.created_at

              return (
                <Box
                  key={s.id}
                  sx={{
                    py: 1.75,
                    borderBottom: i < sessions.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'space-between',
                    gap: 1
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box sx={{ mt: 0.3, color: 'text.secondary', flexShrink: 0 }}>
                      {mobile ? <MobileIcon /> : <DeviceIcon />}
                    </Box>
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', gap: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 500 }}>{deviceName}</Typography>
                        {browser && (
                          <Typography variant="caption" color="text.secondary">{browser}</Typography>
                        )}
                        {s.is_current && (
                          <Chip
                            label="This device"
                            size="small"
                            sx={{ height: 18, fontSize: '0.65rem', bgcolor: 'action.selected', border: '1px solid', borderColor: 'divider' }}
                          />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        {s.location
                          ? `${s.location} · ${formatIP(s.ip_address)}`
                          : formatIP(s.ip_address)
                        } · {timeAgo(lastActive)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                        Expires {formatDate(s.refresh_expires_at)}
                      </Typography>
                    </Box>
                  </Stack>

                  {!s.is_current && (
                    <Button
                      size="small"
                      color="error"
                      disabled={revoking === s.id}
                      onClick={() => onRevoke(s.id)}
                      sx={{ fontSize: '0.75rem', flexShrink: 0, minWidth: 'auto' }}
                    >
                      {revoking === s.id ? '...' : 'Kick'}
                    </Button>
                  )}
                </Box>
              )
            })}
          </Stack>
        )}
      </Stack>
    </Box>
  )
}
