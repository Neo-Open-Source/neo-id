import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'

export const useQueryParams = () => {
  const location = useLocation()
  
  const params = useMemo(() => {
    return new URLSearchParams(location.search)
  }, [location.search])

  const get = (key: string, defaultValue: string = ''): string => {
    return params.get(key) || defaultValue
  }

  const getBoolean = (key: string): boolean => {
    return params.get(key) === '1' || params.get(key) === 'true'
  }

  return {
    params,
    get,
    getBoolean,
  }
}
