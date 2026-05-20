import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile, getProviders, getServices } from '../api/endpoints'
import { ROUTES } from '../constants'

interface Profile {
  id: string
  email: string
  display_name: string
  avatar?: string
  [key: string]: unknown
}

interface Provider {
  provider: string
  [key: string]: unknown
}

interface Services {
  connected_services?: unknown[]
  available_services?: unknown[]
}

export const useProfile = () => {
  const navigate = useNavigate()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [providers, setProviders] = useState<Provider[]>([])
  const [hasPassword, setHasPassword] = useState(false)
  const [services, setServices] = useState<Services>({})
  const [loading, setLoading] = useState(true)

  const loadProfile = async () => {
    setLoading(true)
    try {
      const profileData = await getProfile()
      setProfile(profileData)
      
      if (profileData?.avatar) {
        try {
          localStorage.setItem('neo_id_avatar_cache', profileData.avatar)
        } catch {
          // Ignore storage errors
        }
      }

      const providersData = await getProviders()
      setProviders(providersData.oauth_providers || [])
      setHasPassword(!!providersData.has_password)

      const servicesData = await getServices()
      setServices(servicesData)
    } catch (error) {
      navigate(ROUTES.LOGIN)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (sessionStorage.getItem('2fa_reload')) {
      sessionStorage.removeItem('2fa_reload')
      loadProfile()
    }
  }, [])

  return {
    profile,
    providers,
    hasPassword,
    services,
    loading,
    reload: loadProfile,
  }
}
