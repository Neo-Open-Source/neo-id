import { type ReactNode } from 'react'
import MobilePageShell from './MobilePageShell'
import styles from '../styles/AuthShell.module.css'

export default function AuthShell({
  children,
  title,
  description,
  hero,
  backTo,
  hideFooterText = false,
  desktopSimple = false,
}: {
  children: ReactNode
  title: string
  description: string
  hero?: ReactNode
  backTo?: string
  hideFooterText?: boolean
  desktopSimple?: boolean
}) {
  return (
    <MobilePageShell backTo={backTo} centered desktopSimple={desktopSimple}>
      <div className={styles.shell}>
        {hero ? <div className={styles.hero}>{hero}</div> : null}
        {!hideFooterText ? <div className={styles.copy}><h1>{title}</h1><p>{description}</p></div> : null}
        <div className={styles.body}>{children}</div>
      </div>
    </MobilePageShell>
  )
}
