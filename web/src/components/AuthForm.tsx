import { Input, Button, Spinner } from '@neo-open-source/ui-web'
import PasswordInput from './PasswordInput'
import styles from '../styles/LoginPage.module.css'

interface AuthFormProps {
  email: string
  password: string
  loading: boolean
  isLogin: boolean
  onEmailChange: (value: string) => void
  onPasswordChange: (value: string) => void
  onSubmit: () => void
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void
}

export default function AuthForm({
  email,
  password,
  loading,
  isLogin,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  onKeyDown,
}: AuthFormProps) {
  return (
    <div className={styles.form}>
      <Input
        type="email"
        placeholder="Email address"
        value={email}
        onChange={(e) => onEmailChange(e.target.value)}
        autoComplete="email"
        onKeyDown={onKeyDown}
      />
      <PasswordInput
        placeholder="Password"
        value={password}
        onChange={(e) => onPasswordChange(e.target.value)}
        autoComplete={isLogin ? 'current-password' : 'new-password'}
        onKeyDown={onKeyDown}
      />
      <Button disabled={loading} onClick={onSubmit} className={styles.submit}>
        {loading ? <Spinner /> : isLogin ? 'Continue' : 'Create account'}
      </Button>
    </div>
  )
}
