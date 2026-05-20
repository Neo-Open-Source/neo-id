import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getProfile } from '../api/endpoints'
import { ROUTES } from '../constants'

const CACHE_KEY = 'neo_id_profile_cache'

function readCache(): Record<string, unknown> | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '') } catch { return null }
}
function writeCache(p: Record<string, unknown>) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(p)) } catch {}
}

export function useCachedProfile(redirectOnFail = true) {
  const navigate = useNavigate()
  const initialCached = readCache()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(initialCached)
  const [loading, setLoading] = useState(!initialCached)

  useEffect(() => {
    getProfile()
      .then(p => { setProfile(p); writeCache(p) })
      .catch(() => {
        const cached = readCache()
        if (cached) {
          setProfile(cached)
          return
        }
        if (redirectOnFail) navigate(ROUTES.LOGIN)
      })
      .finally(() => setLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return { profile, loading }
}
