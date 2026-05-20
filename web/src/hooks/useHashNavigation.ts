import { useState, useEffect } from 'react'

export const useHashNavigation = <T extends string>(validSections: readonly T[], defaultSection: T) => {
  const getHashSection = (): T => {
    const hash = window.location.hash.replace('#', '')
    return (validSections as readonly string[]).includes(hash) ? (hash as T) : defaultSection
  }

  const [activeSection, setActiveSection] = useState<T>(getHashSection)

  useEffect(() => {
    window.location.hash = activeSection
  }, [activeSection])

  useEffect(() => {
    const handleHashChange = () => {
      setActiveSection(getHashSection())
    }
    
    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  return {
    activeSection,
    setActiveSection,
  }
}
