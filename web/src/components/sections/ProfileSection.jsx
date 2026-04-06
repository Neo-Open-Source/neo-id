import { useState } from 'react'
import { Box, Stack, Typography, Avatar, Divider } from '@mui/material'
import AvatarPickerDialog from '../AvatarPickerDialog.jsx'

const AVATAR_LG_SX = { width: 56, height: 56, fontSize: '1.25rem' }

function UserAvatar({ src, name, sx = {} }) {
  return (
    <Avatar
      src={src || ''}
      imgProps={{ referrerPolicy: 'no-referrer', crossOrigin: 'anonymous' }}
      sx={{ bgcolor: 'action.selected', color: 'text.primary', ...sx }}
    >
      {!src && (name || '?')[0].toUpperCase()}
    </Avatar>
  )
}

function SectionHeader({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="h6" sx={{ fontWeight: 600 }}>{title}</Typography>
      {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
    </Box>
  )
}

function Field({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.7rem' }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: 500, wordBreak: 'break-all' }}>{value || '—'}</Typography>
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

export default function ProfileSection({ profile, notify, onAvatarSaved }) {
  const [avatarDialogOpen, setAvatarDialogOpen] = useState(false)

  return (
    <Box>
      <SectionHeader title="Profile" subtitle="Your account information" />
      <Card>
        <Stack spacing={3}>
          <Stack direction="row" spacing={2} alignItems="center">
            <Box
              sx={{ position: 'relative', display: 'inline-flex', cursor: 'pointer', flexShrink: 0 }}
              onClick={() => setAvatarDialogOpen(true)}
            >
              <UserAvatar src={profile?.avatar} name={profile?.display_name || profile?.email} sx={AVATAR_LG_SX} />
              <Box sx={{
                position: 'absolute', inset: 0, borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                bgcolor: 'rgba(0,0,0,0.35)', opacity: 0, transition: 'opacity 0.15s',
                '&:hover': { opacity: 1 }
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                  <circle cx="12" cy="13" r="4"/>
                </svg>
              </Box>
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body1" sx={{ fontWeight: 600 }} noWrap>{profile?.display_name}</Typography>
              <Typography variant="body2" color="text.secondary" noWrap>{profile?.email}</Typography>
            </Box>
          </Stack>
          <Divider />
          <Stack spacing={2.5}>
            <Field label="Email" value={profile?.email} />
            <Field label="Display name" value={profile?.display_name} />
            <Field label="Role" value={profile?.role || 'User'} />
            <Field label="Unified ID" value={profile?.unified_id} />
          </Stack>
        </Stack>
      </Card>

      <AvatarPickerDialog
        open={avatarDialogOpen}
        currentAvatar={profile?.avatar}
        displayName={profile?.display_name || profile?.email}
        onClose={() => setAvatarDialogOpen(false)}
        onSaved={(newUrl) => {
          onAvatarSaved?.(newUrl)
          notify?.('success', 'Profile picture updated')
        }}
      />
    </Box>
  )
}
