import { useState } from 'react'
import { Box, Stack, Typography, Button, TextField, Divider } from '@mui/material'

function SectionHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
    </Box>
  )
}

function Card({ children, sx = {} }) {
  return (
    <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 3, ...sx }}>
      {children}
    </Box>
  )
}

const rowBorder = { borderBottom: '1px solid', borderColor: 'divider' }

export default function DeveloperSection({ profile, serviceApps = [], onCreateApp, onRevokeApp, onDeleteApp, onNavigateToServices }) {
  const [newServiceAppName, setNewServiceAppName] = useState('')
  const [issuedToken, setIssuedToken] = useState('')

  const role = (profile?.role || '').toLowerCase()
  const canManageOidc = ['developer', 'admin', 'moderator'].includes(role)

  const handleCreate = async () => {
    if (!newServiceAppName) return
    try {
      const result = await onCreateApp(newServiceAppName)
      setIssuedToken(result?.token || '')
      setNewServiceAppName('')
    } catch {
      // error handling delegated to parent
    }
  }

  return (
    <Box>
      <Stack direction="row" alignItems="flex-start" justifyContent="space-between" sx={{ mb: 3 }}>
        <SectionHeader title="Developer" subtitle="Service tokens for API access" />
        {canManageOidc && (
          <Button variant="outlined" size="small" onClick={onNavigateToServices} sx={{ flexShrink: 0, mt: 0.5 }}>
            Manage OIDC Clients
          </Button>
        )}
      </Stack>
      <Card>
        <Stack spacing={2}>
          <Stack direction="row" spacing={1.5} alignItems="flex-end">
            <TextField label="App name" size="small" value={newServiceAppName} onChange={(e) => setNewServiceAppName(e.target.value)} sx={{ flex: 1 }} />
            <Button variant="contained" size="small" onClick={handleCreate} disabled={!newServiceAppName} sx={{ height: 40, px: 2, flexShrink: 0 }}>Create</Button>
          </Stack>

          {issuedToken && (
            <Box sx={{ bgcolor: 'action.hover', border: '1px solid', borderColor: 'divider', borderRadius: 1.5, p: 2 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 600 }}>Token (copy now — shown once)</Typography>
              <Typography variant="caption" sx={{ fontFamily: 'monospace', wordBreak: 'break-all' }}>{issuedToken}</Typography>
            </Box>
          )}

          <Divider />

          {serviceApps.length === 0
            ? <Typography variant="body2" color="text.secondary">No service apps yet</Typography>
            : (
              <Stack>
                {serviceApps.map((a, i) => (
                  <Box key={a.id} sx={{ py: 1.5, ...(i < serviceApps.length - 1 ? rowBorder : {}), display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>{a.name}</Typography>
                      <Typography variant="caption" color="text.secondary">{a.token_prefix}...{a.revoked_at ? ' · revoked' : ''}</Typography>
                    </Box>
                    <Stack direction="row" spacing={0.5}>
                      {!a.revoked_at && <Button size="small" color="error" onClick={() => onRevokeApp(a.id)} sx={{ fontSize: '0.75rem' }}>Revoke</Button>}
                      <Button size="small" color="error" onClick={() => onDeleteApp(a.id)} sx={{ fontSize: '0.75rem' }}>Delete</Button>
                    </Stack>
                  </Box>
                ))}
              </Stack>
            )
          }
        </Stack>
      </Card>
    </Box>
  )
}
