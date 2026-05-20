import { useState, useCallback } from 'react'

interface Notification {
  type: 'success' | 'error' | 'info' | ''
  text: string
}

export const useNotification = (duration: number = 4000) => {
  const [notification, setNotification] = useState<Notification>({ type: '', text: '' })

  const notify = useCallback((type: 'success' | 'error' | 'info', text: string) => {
    setNotification({ type, text })
    setTimeout(() => {
      setNotification({ type: '', text: '' })
    }, duration)
  }, [duration])

  const clearNotification = useCallback(() => {
    setNotification({ type: '', text: '' })
  }, [])

  return {
    notification,
    notify,
    clearNotification,
  }
}
