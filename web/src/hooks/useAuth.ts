import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { User } from '../types'
import { TOKEN_STORAGE_KEYS, ROUTES } from '../constants'

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkAuth()
  }, [])

  const checkAuth = async () => {
    const token = localStorage.getItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)
    
    if (!token) {
      setLoading(false)
      return
    }

    try {
      const response = await fetch('/api/user/profile', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })

      if (response.ok) {
        const userData = await response.json()
        setUser(userData)
      } else {
        localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)
        localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)
      }
    } catch (error) {
      console.error('Auth check failed:', error)
    } finally {
      setLoading(false)
    }
  }

  const login = (accessToken: string, refreshToken: string) => {
    localStorage.setItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN, accessToken)
    localStorage.setItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN, refreshToken)
    checkAuth()
  }

  const logout = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEYS.ACCESS_TOKEN)
    localStorage.removeItem(TOKEN_STORAGE_KEYS.REFRESH_TOKEN)
    setUser(null)
    navigate(ROUTES.LOGIN)
  }

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login,
    logout,
    checkAuth,
  }
}
