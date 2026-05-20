import styles from '../styles/LoginPage.module.css'

type AuthTab = 'login' | 'register'

interface AuthTabsProps {
  activeTab: AuthTab
  onTabChange: (tab: AuthTab) => void
}

const TAB_LABELS: Record<AuthTab, string> = {
  login: 'Sign in',
  register: 'Create account',
}

export default function AuthTabs({ activeTab, onTabChange }: AuthTabsProps) {
  const tabs: AuthTab[] = ['login', 'register']

  return (
    <div className={styles.tabs}>
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onTabChange(tab)}
          className={`${styles.tabItem} ${activeTab === tab ? styles.tabItemActive : ''}`}
        >
          {TAB_LABELS[tab]}
        </button>
      ))}
    </div>
  )
}
