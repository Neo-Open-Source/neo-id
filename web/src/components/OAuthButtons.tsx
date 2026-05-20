import { GoogleOAuthButton, OAuthButton } from '@neo-open-source/ui-web'
import { Github } from '@neo-open-source/icons'
import { OAUTH_PROVIDERS } from '../constants'
import styles from '../styles/LoginPage.module.css'

interface OAuthButtonsProps {
  onOAuthClick: (provider: string) => void
}

export default function OAuthButtons({ onOAuthClick }: OAuthButtonsProps) {
  return (
    <div className={styles.oauth}>
      <GoogleOAuthButton onClick={() => onOAuthClick(OAUTH_PROVIDERS.GOOGLE)} />
      <OAuthButton
        provider="GitHub"
        icon={
          <span className={styles.githubIcon}>
            <Github size={18} />
          </span>
        }
        onClick={() => onOAuthClick(OAUTH_PROVIDERS.GITHUB)}
      />
    </div>
  )
}
