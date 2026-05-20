import { useState } from 'react'
import { Input } from '@neo-open-source/ui-web'
import { Eye, EyeOff } from 'lucide-react'
import styles from '../styles/PasswordInput.module.css'

interface PasswordInputProps {
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void
  placeholder?: string
  autoComplete?: string
}

export default function PasswordInput({
  value,
  onChange,
  onKeyDown,
  placeholder = 'Password',
  autoComplete = 'current-password',
}: PasswordInputProps) {
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className={styles.wrapper}>
      <Input
        type={showPassword ? 'text' : 'password'}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        autoComplete={autoComplete}
        className={styles.input}
      />
      <button
        type="button"
        className={styles.toggle}
        onClick={() => setShowPassword(!showPassword)}
        aria-label={showPassword ? 'Hide password' : 'Show password'}
      >
        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  )
}
