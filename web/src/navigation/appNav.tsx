import { Command, Settings as SettingsIcon, Shield } from '@neo-open-source/icons'

type AppNavKey = 'settings' | 'developer' | 'admin'

export function buildAppNav(
  role: string,
  active: AppNavKey,
  navigate: (path: string) => void
): { id: AppNavKey; label: string; icon: JSX.Element; active: boolean; onClick: () => void }[] {
  const normalizedRole = (role || '').toLowerCase()
  const isDeveloper = ['developer', 'admin', 'moderator'].includes(normalizedRole)
  const isAdmin = ['admin', 'moderator'].includes(normalizedRole)

  return [
    {
      id: 'settings',
      label: 'Settings',
      icon: <SettingsIcon size={15} />,
      active: active === 'settings',
      onClick: () => navigate('/dashboard')
    },
    ...(isDeveloper
      ? [{
          id: 'developer' as const,
          label: 'Developer',
          icon: <Command size={15} />,
          active: active === 'developer',
          onClick: () => navigate('/developer')
        }]
      : []),
    ...(isAdmin
      ? [{
          id: 'admin' as const,
          label: 'Admin Panel',
          icon: <Shield size={15} />,
          active: active === 'admin',
          onClick: () => navigate('/admin')
        }]
      : [])
  ]
}
