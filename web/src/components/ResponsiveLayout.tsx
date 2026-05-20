import { type ReactNode, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from './AppLayout'
import MobilePageShell from './MobilePageShell'

interface ResponsiveLayoutProps {
  children: ReactNode
  useAppLayout?: boolean
  appLayoutProps?: any
  mobileTitle?: string
  showBackButton?: boolean
  backTo?: string
}

export default function ResponsiveLayout({ 
  children, 
  useAppLayout = false,
  appLayoutProps = {},
  mobileTitle,
  showBackButton = true,
  backTo = '/'
}: ResponsiveLayoutProps) {
  const navigate = useNavigate()
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 768)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  if (!useAppLayout) {
    return <>{children}</>
  }

  if (isMobile) {
    return (
      <MobilePageShell 
        title={mobileTitle || appLayoutProps.title || 'Neo ID'}
        backTo={showBackButton ? backTo : undefined}
      >
        {children}
      </MobilePageShell>
    )
  }

  return <AppLayout {...appLayoutProps}>{children}</AppLayout>
}
