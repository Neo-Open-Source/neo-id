import { useState } from 'react'
import {
  Box, Stack, Typography, Button, Avatar, Drawer, IconButton,
  useMediaQuery, useTheme
} from '@mui/material'
import ThemeToggle from './ThemeToggle.jsx'

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6" x2="21" y2="6"/>
      <line x1="3" y1="12" x2="21" y2="12"/>
      <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>
  )
}

function UserAvatar({ src, name, sx = {} }) {
  return (
    <Avatar
      src={src || ''}
      slotProps={{ img: { referrerPolicy: 'no-referrer', crossOrigin: 'anonymous' } }}
      sx={{ bgcolor: 'action.selected', color: 'text.primary', ...sx }}
    >
      {!src && (name || '?')[0].toUpperCase()}
    </Avatar>
  )
}

/**
 * AppLayout — shared shell for all authenticated pages.
 *
 * Props:
 *   title        — sidebar header title (default "Neo ID")
 *   subtitle     — sidebar header subtitle (optional)
 *   profile      — user profile object { avatar, display_name, email, role }
 *                  if provided, renders an avatar card below the header
 *   navItems     — array of { label, onClick, active?, icon? }
 *   extraNav     — extra buttons rendered below navItems (optional array of { label, onClick })
 *   onLogout     — if provided, renders a "Sign out" button at the bottom
 *   mobileTitle  — title shown in the mobile top bar (defaults to title)
 *   sidebarWidth — sidebar width in px (default 220)
 *   children     — page content
 */
export default function AppLayout({
  title = 'Neo ID',
  subtitle,
  profile,
  navItems = [],
  extraNav = [],
  onLogout,
  mobileTitle,
  sidebarWidth = 220,
  children,
}) {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [drawerOpen, setDrawerOpen] = useState(false)

  const navBtnSx = (active) => ({
    justifyContent: 'flex-start',
    px: 1.5, py: 0.75,
    borderRadius: 1.5,
    fontSize: '0.875rem',
    fontWeight: active ? 600 : 400,
    color: active ? 'text.primary' : 'text.secondary',
    bgcolor: active ? 'action.selected' : 'transparent',
    '&:hover': { bgcolor: 'action.hover', color: 'text.primary' },
  })

  const SidebarContent = ({ onClose }) => (
    <Box sx={{ width: sidebarWidth, display: 'flex', flexDirection: 'column', p: 2, height: '100%' }}>
      <Box sx={{ px: 1, py: 1.5, mb: profile ? 1 : 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>{title}</Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
        )}
      </Box>

      {profile && (
        <Box sx={{ px: 1, py: 1.5, mb: 2, borderRadius: 2, bgcolor: 'action.hover' }}>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <UserAvatar
              src={profile.avatar}
              name={profile.display_name || profile.email}
              sx={{ width: 32, height: 32, fontSize: '0.75rem' }}
            />
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, lineHeight: 1.2 }} noWrap>
                {profile.display_name || profile.email}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {profile.role || 'User'}
              </Typography>
            </Box>
          </Stack>
        </Box>
      )}

      <Stack spacing={0.5} sx={{ flex: 1 }}>
        {navItems.map((item, i) => (
          <Button
            key={i}
            onClick={() => { item.onClick(); onClose?.() }}
            sx={navBtnSx(item.active)}
          >
            {item.icon && (
              <Box component="span" sx={{ mr: 1.25, display: 'flex', alignItems: 'center', opacity: item.active ? 1 : 0.6 }}>
                {item.icon}
              </Box>
            )}
            {item.label}
          </Button>
        ))}
      </Stack>

      <Stack spacing={0.5} sx={{ mt: 2 }}>
        <Box sx={{ pb: 1 }}><ThemeToggle /></Box>
        {extraNav.map((item, i) => (
          <Button key={i} onClick={() => { item.onClick(); onClose?.() }} sx={navBtnSx(false)}>
            {item.label}
          </Button>
        ))}
        {onLogout && (
          <Button
            onClick={onLogout}
            sx={{ justifyContent: 'flex-start', px: 1.5, py: 0.75, borderRadius: 1.5, fontSize: '0.875rem', color: 'error.main', '&:hover': { bgcolor: 'error.main', color: '#fff', opacity: 0.9 } }}
          >
            Sign out
          </Button>
        )}
      </Stack>
    </Box>
  )

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Mobile top bar */}
      {isMobile && (
        <Box sx={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
          bgcolor: 'background.paper', borderBottom: '1px solid', borderColor: 'divider',
          px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between'
        }}>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>
            {mobileTitle || title}
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <ThemeToggle />
            <IconButton size="small" onClick={() => setDrawerOpen(true)} sx={{ color: 'text.primary' }}>
              <MenuIcon />
            </IconButton>
          </Stack>
        </Box>
      )}

      {/* Desktop sidebar */}
      {!isMobile && (
        <Box sx={{
          width: sidebarWidth, flexShrink: 0,
          bgcolor: 'background.paper',
          borderRight: '1px solid', borderColor: 'divider',
          position: 'sticky', top: 0, height: '100vh', overflow: 'hidden',
          display: 'flex', flexDirection: 'column'
        }}>
          <SidebarContent />
        </Box>
      )}

      {/* Mobile drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        PaperProps={{ sx: { bgcolor: 'background.paper', width: sidebarWidth + 20 } }}
      >
        <SidebarContent onClose={() => setDrawerOpen(false)} />
      </Drawer>

      {/* Page content */}
      <Box component="main" sx={{ flex: 1, pt: { xs: 9, md: 0 } }}>
        {children}
      </Box>
    </Box>
  )
}
