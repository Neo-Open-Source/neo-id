import { Box, Tooltip } from '@mui/material'
import { useThemeMode } from '../app/ThemeContext.jsx'

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
)

const SystemIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
  </svg>
)

const OPTIONS = [
  { value: 'light', icon: <SunIcon />, label: 'Light' },
  { value: 'system', icon: <SystemIcon />, label: 'System' },
  { value: 'dark', icon: <MoonIcon />, label: 'Dark' },
]

export default function ThemeToggle() {
  const { mode, setMode } = useThemeMode()

  return (
    <Box sx={{
      display: 'inline-flex',
      alignItems: 'center',
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
      p: 0.25,
      gap: 0.25,
      bgcolor: 'background.paper'
    }}>
      {OPTIONS.map(({ value, icon, label }) => (
        <Tooltip key={value} title={label} placement="bottom">
          <Box
            onClick={() => setMode(value)}
            sx={{
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 1.5,
              cursor: 'pointer',
              color: mode === value ? 'text.primary' : 'text.secondary',
              bgcolor: mode === value ? 'action.selected' : 'transparent',
              transition: 'all 0.15s',
              '&:hover': { bgcolor: 'action.hover', color: 'text.primary' }
            }}
          >
            {icon}
          </Box>
        </Tooltip>
      ))}
    </Box>
  )
}
