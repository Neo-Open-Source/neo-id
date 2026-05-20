import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from '@neo-open-source/icons'
import { ThemeToggle } from '@neo-open-source/ui-web'
import { useThemeMode } from '../app/ThemeContext'
import styles from '../styles/MobilePageShell.module.css'

export default function MobilePageShell({
  children,
  title,
  backTo,
  backLabel = 'Back',
  logo = true,
  footer = true,
  centered = false,
  desktopSimple = false,
}: {
  children: ReactNode
  title?: string
  backTo?: string | number
  backLabel?: string
  logo?: boolean
  footer?: boolean
  centered?: boolean
  desktopSimple?: boolean
}) {
  const { resolved, setMode } = useThemeMode()
  const navigate = useNavigate()
  const dark = resolved === 'dark'

  return (
    <div className={`${styles.shell} ${desktopSimple ? styles.desktopSimple : ''}`}>
      <div className={styles.inner}>
        <header className={styles.header}>
          <div className={`${styles.headerSide} ${styles.headerSideLeft}`}>
            {typeof backTo === 'string' ? (
              <Link to={backTo} className={styles.back} aria-label={backLabel}>
                <ChevronLeft size={20} />
              </Link>
            ) : typeof backTo === 'number' ? (
              <button type="button" className={styles.back} aria-label={backLabel} onClick={() => navigate(backTo)}>
                <ChevronLeft size={20} />
              </button>
            ) : null}
          </div>
          <div className={styles.headerCenter}>
            {title ? <span className={styles.title}>{title}</span> : null}
            {!title && logo ? <Link to="/" className={styles.brand}>Neo ID</Link> : null}
          </div>
          <div className={`${styles.headerSide} ${styles.headerSideRight}`}>
            <div className={styles.theme}><ThemeToggle dark={dark} onChange={v => setMode(v ? 'dark' : 'light')} /></div>
          </div>
        </header>

        <main className={`${styles.content} ${centered ? styles.contentCentered : ''}`}>
          {children}
        </main>

        {footer ? (
          <footer className={styles.footer}>
            <div className={styles.links}>
              <Link to="/terms">Terms</Link>
              <Link to="/privacy">Privacy</Link>
            </div>
          </footer>
        ) : null}
      </div>

    </div>
  )
}
